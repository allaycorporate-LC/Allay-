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

  async sendAs(fromUserId, toUserId, points, program, message, companyId) {
    const { data, error } = await _sb.rpc('send_recognition_as', {
      p_from_user_id: fromUserId,
      p_to_user_id:   toUserId,
      p_points:       points ?? 0,
      p_program:      program,
      p_message:      message,
      p_company_id:   companyId
    });
    if (error) console.error('send_recognition_as error:', error.message);
    return { isOk: !error, id: data, error };
  },

  async list(offset = 0, limit = 10, companyId = null, program = null) {
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
    if (program)   query = query.eq('program', program);

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) console.error('recognitions list error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async delete(id) {
    const { error } = await _sb.from('recognitions').delete().eq('id', id);
    if (error) console.error('recognition delete error:', error.message);
    return { isOk: !error };
  },

  async recentForUser(userId, limit = 6) {
    const [rcv, snt] = await Promise.all([
      _sb.from('recognitions')
        .select('id, points, program, created_at, from_user:profiles!recognitions_from_user_id_fkey(id, name)')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      _sb.from('recognitions')
        .select('id, points, program, created_at, to_user:profiles!recognitions_to_user_id_fkey(id, name)')
        .eq('from_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);
    const data = [
      ...(rcv.data || []).map(r => ({ ...r, _type: 'received' })),
      ...(snt.data || []).map(r => ({ ...r, _type: 'sent' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
    return { isOk: !rcv.error && !snt.error, data };
  },

  async forCompany(companyId, limit = 300) {
    let query = _sb.from('recognitions')
      .select('id, program, from_user:profiles!recognitions_from_user_id_fkey(id, name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query;
    if (error) console.error('recognitions forCompany error:', error.message);
    return { isOk: !error, data: data || [] };
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
  },

  // Fetch feed bypassing RLS — used during impersonation or when RLS blocks company reads
  async listForCompany(companyId, offset = 0, limit = 10, program = null) {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      const token = session?.access_token || SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-company-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ company_id: companyId, offset, limit, program }),
      });
      const json = await res.json().catch(() => ({}));
      return { isOk: res.ok, data: json.data || [] };
    } catch (e) {
      console.error('listForCompany error:', e);
      return { isOk: false, data: [] };
    }
  },

  // Subscribe to new recognitions for a company via Supabase Realtime
  subscribeToNew(companyId, callback) {
    const name = `recog-rt-${companyId || 'all'}`;
    const opts = { event: 'INSERT', schema: 'public', table: 'recognitions' };
    if (companyId) opts.filter = `company_id=eq.${companyId}`;
    return _sb.channel(name).on('postgres_changes', opts, callback).subscribe();
  },

  unsubscribeChannel(ch) {
    if (ch) _sb.removeChannel(ch);
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

  // Fetch notifications for a specific user (bypasses RLS — for admin impersonation)
  async listForUser(userId) {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      const token = session?.access_token || SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-user-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await res.json().catch(() => ({}));
      return { isOk: res.ok, data: json.data || [] };
    } catch (e) {
      console.error('listForUser error:', e);
      return { isOk: false, data: [] };
    }
  },

  // Create recognition notifications for a list of recipients (uses service role)
  async sendRecognitionNotifications(recipients, fromUserId, points, program) {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      const token = session?.access_token || SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-recognition-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ recipients, from_user_id: fromUserId, points, program }),
      });
      if (!res.ok) console.error('sendRecognitionNotifications failed:', await res.text());
      return { isOk: res.ok };
    } catch (e) {
      console.error('sendRecognitionNotifications error:', e);
      return { isOk: false };
    }
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
  },

  // Send one or more generic notifications via service role (bypasses RLS)
  async send(notifications) {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      const token = session?.access_token || SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-recognition-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ notifications }),
      });
      if (!res.ok) console.error('send-notification failed:', await res.text());
      return { isOk: res.ok };
    } catch (e) {
      console.error('send-notification error:', e);
      return { isOk: false };
    }
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
  // Uses get-company-feed edge function with analytics mode to bypass RLS
  async _fetch(companyId, fromISO = null, toISO = null) {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      const token = session?.access_token || SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-company-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ company_id: companyId, analytics: true, from_date: fromISO, to_date: toISO }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { console.error('analyticsSdk fetch error:', json.error); return []; }
      return json.data || [];
    } catch (e) {
      console.error('analyticsSdk fetch exception:', e);
      return [];
    }
  },

  _profileById(id) {
    // allUsers is declared in app.js global scope, accessible as window.allUsers
    const users = window.allUsers || (typeof allUsers !== 'undefined' ? allUsers : []);
    return users.find(u => u.__backendId === id || u.id === id);
  },

  async summary(companyId) {
    const rows   = await this._fetch(companyId);
    const now    = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return {
      isOk: true,
      data: {
        total_recognitions: rows.length,
        total_points:       rows.reduce((s, r) => s + (r.points || 0), 0),
        active_senders:     new Set(rows.map(r => r.from_user_id)).size,
        this_month:         rows.filter(r => r.created_at >= mStart).length,
      }
    };
  },

  async topRecognized(companyId, limit = 8) {
    const rows = await this._fetch(companyId);
    const map  = {};
    for (const r of rows) {
      const uid = r.to_user_id;
      if (!uid) continue;
      if (!map[uid]) {
        const p = this._profileById(uid);
        map[uid] = { name: p?.name || uid, total_points: 0, count: 0 };
      }
      map[uid].total_points += r.points || 0;
      map[uid].count++;
    }
    return { isOk: true, data: Object.values(map).sort((a, b) => b.total_points - a.total_points).slice(0, limit) };
  },

  async byDepartment(companyId) {
    const rows = await this._fetch(companyId);
    const map  = {};
    for (const r of rows) {
      const p    = this._profileById(r.to_user_id);
      const dept = p?.department || 'Sin área';
      map[dept]  = (map[dept] || 0) + 1;
    }
    return {
      isOk: true,
      data: Object.entries(map)
        .map(([department, recognition_count]) => ({ department, recognition_count }))
        .sort((a, b) => b.recognition_count - a.recognition_count)
    };
  },

  async byRange(companyId, fromDate, toDate) {
    const fromISO = fromDate ? fromDate + 'T00:00:00.000Z' : null;
    // End of last day of toDate month: subtract 1ms from first moment of next month
    const toISO = toDate ? (() => {
      const base = new Date(toDate.substring(0, 7) + '-01T00:00:00.000Z');
      base.setUTCMonth(base.getUTCMonth() + 1);
      base.setUTCMilliseconds(-1);
      return base.toISOString();
    })() : null;
    const rows = await this._fetch(companyId, fromISO, toISO);
    const map  = {};
    for (const r of rows) {
      const month = r.created_at.substring(0, 7);
      if (!map[month]) map[month] = { month, recognition_count: 0, total_points: 0 };
      map[month].recognition_count++;
      map[month].total_points += r.points || 0;
    }
    return { isOk: true, data: Object.values(map).sort((a, b) => a.month.localeCompare(b.month)) };
  },
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
      // Use same path pattern as uploadCommentImage so bucket policies apply
      const file = new File([blob], `recognition_${Date.now()}.jpg`, { type: 'image/jpeg' });
      return this.uploadCommentImage(file);
    } catch (e) {
      console.error('uploadRecognitionImage exception:', e);
      return { isOk: false };
    }
  }
};

// ─── Redemptions SDK ──────────────────────────────────────────────────────────
window.redemptionsSdk = {
  async recentForUser(userId, limit = 4) {
    let query = _sb.from('redemptions')
      .select('id, points_spent, created_at, reward:rewards(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) console.error('redemptions list error:', error.message);
    return { isOk: !error, data: data || [] };
  }
};
