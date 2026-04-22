// ─────────────────────────────────────────────────────────────────────────────
// Allay — Supabase Data SDK
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL     = 'https://smuwnjpmpmwfuysrxkaa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtdXduanBtcG13ZnV5c3J4a2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjU3MTAsImV4cCI6MjA5MjIwMTcxMH0.onYPx78n5TaSeig3VQebQY9E6ClvxKZ8eAIebaxLDRQ';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function mapProfile(p) {
  return {
    __backendId:      p.id,
    name:             p.name,
    email:            p.email,
    department:       p.department,
    company_id:       p.company_id,
    role:             p.role,
    points_to_give:   p.points_to_give,
    points_to_redeem: p.points_to_redeem,
    password_changed: p.password_changed,
    user_id:          p.email
  };
}

window.dataSdk = (function () {
  let _handler = null;

  async function fetchAndNotify() {
    const { data, error } = await _sb.from('profiles').select('*');
    if (error) { console.error('dataSdk fetch error:', error.message); return; }
    if (_handler) _handler.onDataChanged((data || []).map(mapProfile));
  }

  return {
    async init(handler) {
      _handler = handler;

      _sb.channel('profiles-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchAndNotify)
        .subscribe();

      return { isOk: true };
    },

    async refresh() {
      await fetchAndNotify();
    },

    async create(record) {
      try {
        const { data: { session } } = await _sb.auth.getSession();
        const token = session?.access_token || SUPABASE_ANON_KEY;

        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            email:            record.email,
            password:         record.password         || 'Allay2024!',
            name:             record.name,
            department:       record.department        || 'General',
            company_id:       record.company_id        || 'comp-1',
            role:             record.role              || 'employee',
            points_to_give:   record.points_to_give   ?? 100,
            points_to_redeem: record.points_to_redeem ?? 0,
          })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errorMessage = json?.error || `Error ${res.status}`;
          console.error('create-user error:', errorMessage);
          return { isOk: false, error: errorMessage };
        }
        return { isOk: true, data: json };
      } catch (e) {
        console.error('create-user exception:', e);
        return { isOk: false, error: e.message || 'Error de conexión' };
      }
    },

    async update(record) {
      const { error } = await _sb.from('profiles').update({
        name:             record.name,
        department:       record.department,
        company_id:       record.company_id,
        role:             record.role,
        points_to_give:   record.points_to_give,
        points_to_redeem: record.points_to_redeem,
        password_changed: record.password_changed
      }).eq('id', record.__backendId);
      if (error) { console.error('update error:', error.message); }
      return { isOk: !error };
    },

    async delete(record) {
      const { error } = await _sb.functions.invoke('delete-user', {
        body: { user_id: record.__backendId }
      });
      if (error) { console.error('delete-user error:', error); }
      return { isOk: !error };
    }
  };
})();

// ─── Recognition SDK ─────────────────────────────────────────────────────────
window.recognitionSdk = {
  async send(toUserId, points, program, message, companyId) {
    const { data, error } = await _sb.rpc('send_recognition', {
      p_to_user_id: toUserId,
      p_points:     points ?? 0,
      p_program:    program,
      p_message:    message,
      p_company_id: companyId
    });
    if (error) console.error('send_recognition error:', error.message);
    return { isOk: !error, id: data, error };
  },

  async list(offset = 0, limit = 10, companyId = null) {
    let query = _sb
      .from('recognitions')
      .select(`
        id, points, program, message, created_at, company_id,
        from_user:profiles!recognitions_from_user_id_fkey(id, name),
        to_user:profiles!recognitions_to_user_id_fkey(id, name),
        reactions(emoji, user_id),
        comments(id, message, created_at, user:profiles!comments_user_id_fkey(id, name))
      `)
      .order('created_at', { ascending: false });

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) console.error('recognitions list error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async delete(id) {
    const { error } = await _sb.from('recognitions').delete().eq('id', id);
    if (error) console.error('recognition delete error:', error.message);
    return { isOk: !error };
  },

  async toggleReaction(recognitionId, emoji, userId) {
    const { data: existing } = await _sb.from('reactions')
      .select('id').eq('recognition_id', recognitionId)
      .eq('user_id', userId).eq('emoji', emoji).maybeSingle();

    if (existing) {
      const { error } = await _sb.from('reactions').delete().eq('id', existing.id);
      return { isOk: !error, action: 'removed' };
    }
    const { error } = await _sb.from('reactions')
      .insert({ recognition_id: recognitionId, user_id: userId, emoji });
    return { isOk: !error, action: 'added' };
  },

  async addComment(recognitionId, userId, message) {
    const { data, error } = await _sb.from('comments')
      .insert({ recognition_id: recognitionId, user_id: userId, message })
      .select('id, message, created_at, user:profiles!comments_user_id_fkey(id, name)')
      .single();
    if (error) console.error('addComment error:', error.message);
    return { isOk: !error, data };
  }
};

// ─── Notification SDK ─────────────────────────────────────────────────────────
window.notificationSdk = {
  async list() {
    const { data, error } = await _sb.from('notifications')
      .select('*').order('created_at', { ascending: false }).limit(50);
    if (error) console.error('notifications list error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async markRead(id) {
    const { error } = await _sb.from('notifications').update({ read: true }).eq('id', id);
    return { isOk: !error };
  },

  async markAllRead() {
    const { error } = await _sb.from('notifications')
      .update({ read: true }).eq('read', false);
    return { isOk: !error };
  },

  async remove(id) {
    const { error } = await _sb.from('notifications').delete().eq('id', id);
    return { isOk: !error };
  }
};

// ─── Reward SDK ───────────────────────────────────────────────────────────────
window.rewardSdk = {
  async list(companyId) {
    const { data, error } = await _sb.from('rewards')
      .select('*').eq('company_id', companyId).eq('available', true)
      .order('points_cost');
    if (error) console.error('rewards list error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async redeem(rewardId) {
    const { data, error } = await _sb.rpc('redeem_reward', { p_reward_id: rewardId });
    if (error) console.error('redeem_reward error:', error.message);
    return { isOk: !error, id: data, error };
  }
};

// ─── Programs SDK ─────────────────────────────────────────────────────────────
window.programsSdk = {
  async list(companyId) {
    const { data, error } = await _sb.from('programs')
      .select('*').eq('company_id', companyId)
      .order('created_at');
    if (error) console.error('programs list error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async create(companyId, name, emoji) {
    const { data, error } = await _sb.from('programs')
      .insert({ company_id: companyId, name, emoji })
      .select().single();
    if (error) console.error('programs create error:', error.message);
    return { isOk: !error, data };
  },

  async update(id, updates) {
    const { error } = await _sb.from('programs').update(updates).eq('id', id);
    if (error) console.error('programs update error:', error.message);
    return { isOk: !error };
  },

  async delete(id) {
    const { error } = await _sb.from('programs').delete().eq('id', id);
    if (error) console.error('programs delete error:', error.message);
    return { isOk: !error };
  }
};

// ─── Analytics SDK ────────────────────────────────────────────────────────────
window.analyticsSdk = {
  async summary() {
    const { data, error } = await _sb.rpc('analytics_summary');
    if (error) console.error('analytics_summary error:', error.message);
    return { isOk: !error, data: (data || [])[0] || null };
  },

  async topRecognized(limit = 10) {
    const { data, error } = await _sb.rpc('analytics_top_recognized', { p_limit: limit });
    if (error) console.error('analytics_top_recognized error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async byDepartment() {
    const { data, error } = await _sb.rpc('analytics_by_department');
    if (error) console.error('analytics_by_department error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async byMonth(months = 6) {
    const { data, error } = await _sb.rpc('analytics_by_month', { p_months: months });
    if (error) console.error('analytics_by_month error:', error.message);
    return { isOk: !error, data: data || [] };
  }
};

// ─── Auth SDK ─────────────────────────────────────────────────────────────────
window.authSdk = {
  async login(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    return { isOk: !error, user: data?.user, error };
  },

  async logout() {
    const { error } = await _sb.auth.signOut();
    return { isOk: !error };
  },

  async updatePassword(newPassword) {
    const { error } = await _sb.auth.updateUser({ password: newPassword });
    return { isOk: !error, error };
  }
};

// ─── Storage SDK ──────────────────────────────────────────────────────────────
window.storageSdk = {
  async uploadCommentImage(file) {
    try {
      const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
      const path = `comments/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await _sb.storage.from('comment-images').upload(path, file, { contentType: file.type });
      if (error) { console.error('image upload error:', error.message); return { isOk: false }; }
      const { data: { publicUrl } } = _sb.storage.from('comment-images').getPublicUrl(path);
      return { isOk: true, url: publicUrl };
    } catch (e) {
      console.error('storageSdk upload exception:', e);
      return { isOk: false };
    }
  },

  async uploadRecognitionImage(base64DataUrl) {
    try {
      const res  = await fetch(base64DataUrl);
      const blob = await res.blob();
      const path = `recognitions/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await _sb.storage.from('comment-images').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) { console.error('recognition image upload error:', error.message); return { isOk: false }; }
      const { data: { publicUrl } } = _sb.storage.from('comment-images').getPublicUrl(path);
      return { isOk: true, url: publicUrl };
    } catch (e) {
      console.error('uploadRecognitionImage exception:', e);
      return { isOk: false };
    }
  }
};
