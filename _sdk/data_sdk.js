// ─────────────────────────────────────────────────────────────────────────────
// Allay — Supabase Data SDK
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL     = 'https://smuwnjpmpmwfuysrxkaa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtdXduanBtcG13ZnV5c3J4a2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjU3MTAsImV4cCI6MjA5MjIwMTcxMH0.onYPx78n5TaSeig3VQebQY9E6ClvxKZ8eAIebaxLDRQ';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._sb = _sb; // exposed for RPC calls that need the authenticated client

// Solo loguear en desarrollo — no exponer errores internos en producción
var _isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
var _log   = _isDev ? (...a) => console.error(...a) : () => {};

function mapProfile(p) {
  return {
    __backendId:       p.id,
    name:              p.name,
    email:             p.email,
    department:        p.department,
    company_id:        p.company_id,
    role:              p.role,
    points_to_give:    p.points_to_give,
    points_to_redeem:  p.points_to_redeem,
    password_changed:  p.password_changed,
    birthday:          p.birthday          || null,  // 'DD/MM'
    anniversary_date:  p.anniversary_date  || null,  // 'YYYY-MM-DD'
    auto_birthday:     p.auto_birthday     ?? true,
    auto_anniversary:  p.auto_anniversary  ?? true,
    user_id:           p.email
  };
}

window.dataSdk = (function () {
  let _handler = null;

  async function fetchAndNotify() {
    const { data, error } = await _sb.from('profiles').select('*');
    if (error) { _log('dataSdk fetch error:', error.message); return; }
    if (_handler) _handler.onDataChanged((data || []).map(mapProfile));
  }

  let _profilesRtChannel = null;

  return {
    async init(handler) {
      _handler = handler;

      // Clean up any existing channel before creating a new one
      if (_profilesRtChannel) {
        _sb.removeChannel(_profilesRtChannel);
        _profilesRtChannel = null;
      }

      // Unique name prevents Supabase from reusing a stale channel object
      _profilesRtChannel = _sb
        .channel(`profiles-rt-${Date.now()}`)
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
            birthday:         record.birthday          || null,
            anniversary_date: record.anniversary_date  || null,
            auto_birthday:    record.auto_birthday     ?? true,
            auto_anniversary: record.auto_anniversary  ?? true,
          })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errorMessage = json?.error || `Error ${res.status}`;
          _log('create-user error:', errorMessage);
          return { isOk: false, error: errorMessage };
        }
        return { isOk: true, data: json };
      } catch (e) {
        _log('create-user exception:', e);
        return { isOk: false, error: e.message || 'Error de conexión' };
      }
    },

    async update(record) {
      const payload = {
        name:             record.name,
        department:       record.department,
        company_id:       record.company_id,
        role:             record.role,
        points_to_give:   record.points_to_give,
        points_to_redeem: record.points_to_redeem,
        password_changed: record.password_changed,
      };
      // Include date fields only when explicitly provided
      if ('birthday'         in record) payload.birthday          = record.birthday || null;
      if ('anniversary_date' in record) payload.anniversary_date  = record.anniversary_date || null;
      if ('auto_birthday'    in record) payload.auto_birthday     = record.auto_birthday ?? true;
      if ('auto_anniversary' in record) payload.auto_anniversary  = record.auto_anniversary ?? true;

      const { error } = await _sb.from('profiles').update(payload).eq('id', record.__backendId);
      if (error) { _log('update error:', error.message); }
      return { isOk: !error };
    },

    async delete(record) {
      const { error } = await _sb.functions.invoke('delete-user', {
        body: { user_id: record.__backendId }
      });
      if (error) { _log('delete-user error:', error); }
      return { isOk: !error };
    }
  };
})();

// ─── Recognition SDK ─────────────────────────────────────────────────────────
window.recognitionSdk = {
  async send(toUserId, points, program, message, companyId, isPrivate = false) {
    const finalMsg = isPrivate ? message + '\n[allay_private]' : message;
    const { data, error } = await _sb.rpc('send_recognition', {
      p_to_user_id: toUserId,
      p_points:     points ?? 0,
      p_program:    program,
      p_message:    finalMsg,
      p_company_id: companyId,
    });
    if (error) _log('send_recognition error:', error.message);
    return { isOk: !error, id: data, error };
  },

  async sendAs(fromUserId, toUserId, points, program, message, companyId, isPrivate = false) {
    const finalMsg = isPrivate ? message + '\n[allay_private]' : message;
    const { data, error } = await _sb.rpc('send_recognition_as', {
      p_from_user_id: fromUserId,
      p_to_user_id:   toUserId,
      p_points:       points ?? 0,
      p_program:      program,
      p_message:      finalMsg,
      p_company_id:   companyId,
    });
    if (error) _log('send_recognition_as error:', error.message);
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
    if (error) _log('recognitions list error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async delete(id) {
    const { error } = await _sb.from('recognitions').delete().eq('id', id);
    if (error) _log('recognition delete error:', error.message);
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
    if (error) _log('recognitions forCompany error:', error.message);
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
    if (error) _log('addComment error:', error.message);
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
      _log('listForCompany error:', e);
      return { isOk: false, data: [] };
    }
  },

  // Subscribe to new recognitions for a company via Supabase Realtime
  subscribeToNew(companyId, callback) {
    // Timestamp suffix guarantees a fresh channel object every time,
    // preventing Supabase from returning a stale channel with existing listeners.
    const name = `recog-rt-${companyId || 'all'}-${Date.now()}`;
    const opts = { event: 'INSERT', schema: 'public', table: 'recognitions' };
    if (companyId) opts.filter = `company_id=eq.${companyId}`;
    return _sb.channel(name).on('postgres_changes', opts, callback).subscribe();
  },

  unsubscribeChannel(ch) {
    if (ch) _sb.removeChannel(ch);
  }
};

// ─── Approvals SDK ────────────────────────────────────────────────────────────
window.approvalsSdk = {
  async load(companyId) {
    const { data, error } = await _sb
      .from('program_budget_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { _log('approvals load error:', error.message); return { isOk: false, queue: [], history: [] }; }
    const queue   = (data || []).filter(r => r.status === 'pending');
    const history = (data || []).filter(r => r.status !== 'pending');
    return { isOk: true, queue, history };
  },

  async add(req) {
    const { error } = await _sb.from('program_budget_requests').insert({
      id:            req.id,
      company_id:    req.company_id,
      requested_by:  req.requestedByUserId || null,
      status:        'pending',
      data:          req,
      created_at:    req.requestedAt || new Date().toISOString(),
    });
    if (error) _log('approvals add error:', error.message);
    return { isOk: !error };
  },

  async updateStatus(id, status, processedByUserId) {
    const { error } = await _sb
      .from('program_budget_requests')
      .update({ status, processed_at: new Date().toISOString(), processed_by: processedByUserId || null })
      .eq('id', id);
    if (error) _log('approvals update error:', error.message);
    return { isOk: !error };
  },
};

// ─── Auto Recognition SDK ─────────────────────────────────────────────────────
window.autoRecognitionSdk = {
  async getSettings(companyId) {
    const { data, error } = await _sb
      .from('auto_recognition_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) _log('autoRecognition getSettings error:', error.message);
    return { isOk: !error, data };
  },

  async saveSettings(settings) {
    const payload = { ...settings, updated_at: new Date().toISOString() };
    let { error } = await _sb
      .from('auto_recognition_settings')
      .upsert(payload, { onConflict: 'company_id' });

    // If send_time column doesn't exist yet (fix_18 not applied), retry without it
    if (error && error.message?.includes('send_time')) {
      const { send_time, ...payloadWithout } = payload;
      const retry = await _sb
        .from('auto_recognition_settings')
        .upsert(payloadWithout, { onConflict: 'company_id' });
      error = retry.error;
    }

    if (error) _log('autoRecognition saveSettings error:', error.message);
    return { isOk: !error };
  },

  async triggerManual(companyId) {
    const { data, error } = await _sb.functions.invoke('send-auto-recognitions', {
      body: { company_id: companyId },
    });
    if (error) _log('autoRecognition triggerManual error:', error);
    return { isOk: !error, data };
  },
};

// ─── Support SDK ──────────────────────────────────────────────────────────────
window.supportSdk = {
  async submit({ userId, companyId, name, email, subject, message }) {
    const { error } = await _sb.from('support_requests').insert({
      user_id: userId || null, company_id: companyId || null,
      name, email, subject, message,
    });
    if (error) _log('support submit error:', error.message);
    return { isOk: !error };
  },
};

// ─── Notification SDK ─────────────────────────────────────────────────────────
window.notificationSdk = {
  async list() {
    const { data, error } = await _sb.from('notifications')
      .select('*').order('created_at', { ascending: false }).limit(50);
    if (error) _log('notifications list error:', error.message);
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
      _log('listForUser error:', e);
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
      if (!res.ok) _log('sendRecognitionNotifications failed:', await res.text());
      return { isOk: res.ok };
    } catch (e) {
      _log('sendRecognitionNotifications error:', e);
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
      if (!res.ok) _log('send-notification failed:', await res.text());
      return { isOk: res.ok };
    } catch (e) {
      _log('send-notification error:', e);
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
    if (error) _log('rewards list error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async redeem(rewardId) {
    const { data, error } = await _sb.rpc('redeem_reward', { p_reward_id: rewardId });
    if (error) _log('redeem_reward error:', error.message);
    return { isOk: !error, id: data, error };
  }
};

// ─── Programs SDK ─────────────────────────────────────────────────────────────
window.programsSdk = {
  async list(companyId) {
    const { data, error } = await _sb.from('programs')
      .select('*').eq('company_id', companyId)
      .order('created_at');
    if (error) _log('programs list error:', error.message);
    return { isOk: !error, data: data || [] };
  },

  async create(companyId, name, emoji) {
    const { data, error } = await _sb.from('programs')
      .insert({ company_id: companyId, name, emoji })
      .select().single();
    if (error) _log('programs create error:', error.message);
    return { isOk: !error, data };
  },

  async update(id, updates) {
    const { error } = await _sb.from('programs').update(updates).eq('id', id);
    if (error) _log('programs update error:', error.message);
    return { isOk: !error };
  },

  async delete(id) {
    const { error } = await _sb.from('programs').delete().eq('id', id);
    if (error) _log('programs delete error:', error.message);
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
      if (!res.ok) { _log('analyticsSdk fetch error:', json.error); return []; }
      return json.data || [];
    } catch (e) {
      _log('analyticsSdk fetch exception:', e);
      return [];
    }
  },

  _profileById(id) {
    // allUsers is declared in app.js global scope, accessible as window.allUsers
    const users = window.allUsers || (typeof allUsers !== 'undefined' ? allUsers : []);
    return users.find(u => u.__backendId === id || u.id === id);
  },

  async summary(companyId, fromISO = null, toISO = null) {
    const rows   = await this._fetch(companyId, fromISO, toISO);
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

  async topRecognized(companyId, limit = 8, fromISO = null, toISO = null) {
    const rows = await this._fetch(companyId, fromISO, toISO);
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

  async byDepartment(companyId, fromISO = null, toISO = null) {
    const rows = await this._fetch(companyId, fromISO, toISO);
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

  async _fetchPrograms(companyId, fromISO = null, toISO = null) {
    try {
      let q = _sb.from('recognitions')
        .select('id, program, points, from_user_id, to_user_id, created_at, company_id')
        .order('created_at', { ascending: true })
        .limit(5000);
      if (companyId) q = q.eq('company_id', companyId);
      if (fromISO)   q = q.gte('created_at', fromISO);
      if (toISO)     q = q.lte('created_at', toISO);
      const { data, error } = await q;
      if (error) { _log('_fetchPrograms error:', error.message); return []; }
      return data || [];
    } catch (e) {
      _log('_fetchPrograms exception:', e);
      return [];
    }
  },

  async participationPatterns(companyId, fromISO = null, toISO = null) {
    const _all  = window.allUsers || (typeof allUsers !== 'undefined' ? allUsers : []);
    const rows  = await this._fetch(companyId, fromISO, toISO);
    const users = _all.filter(u =>
      u.role !== 'superadmin' && (companyId ? u.company_id === companyId : true)
    );
    const adminIds = new Set(users.filter(u => u.role === 'admin').map(u => u.__backendId));
    const deptOf   = {};
    users.forEach(u => deptOf[u.__backendId] = u.department || 'Sin área');

    const byDOW  = Array(7).fill(0);   // 0=Lun … 6=Dom
    const byHour = Array(24).fill(0);
    const weekMap = {}, tmMap = {};
    let adminSent = 0;

    rows.forEach(r => {
      const d = new Date(r.created_at);
      if (isNaN(d.getTime())) return;
      byDOW[(d.getDay() + 6) % 7]++;
      byHour[d.getHours()]++;
      if (adminIds.has(r.from_user_id)) adminSent++;

      // ISO week
      const dc = new Date(d); dc.setHours(0,0,0,0);
      dc.setDate(dc.getDate() + 3 - (dc.getDay() + 6) % 7);
      const jan4 = new Date(dc.getFullYear(), 0, 4);
      const wn   = 1 + Math.round(((dc - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
      const wk   = `${dc.getFullYear()}-W${String(wn).padStart(2, '0')}`;
      if (!weekMap[wk]) weekMap[wk] = { week: wk, count: 0, label: `S${wn} ${dc.getFullYear()}` };
      weekMap[wk].count++;

      // Team by month
      const dept  = deptOf[r.from_user_id] || 'Sin área';
      const month = r.created_at.substring(0, 7);
      if (!tmMap[dept]) tmMap[dept] = {};
      tmMap[dept][month] = (tmMap[dept][month] || 0) + 1;
    });

    const weeklyEvolution = Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));
    const allMonths       = [...new Set(rows.map(r => r.created_at.substring(0, 7)))].sort();
    const teamTotals      = Object.entries(tmMap)
      .map(([dept, months]) => ({ dept, months, total: Object.values(months).reduce((s, c) => s + c, 0) }))
      .sort((a, b) => b.total - a.total).slice(0, 6);

    // Spike detection
    const counts = weeklyEvolution.map(w => w.count);
    const mean   = counts.length ? counts.reduce((s, c) => s + c, 0) / counts.length : 0;
    const stddev = counts.length ? Math.sqrt(counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length) : 0;
    const spikes = weeklyEvolution.filter(w => w.count > mean + 1.5 * stddev);

    return { isOk: true, data: { byDOW, byHour, weeklyEvolution, teamTotals, allMonths, spikes,
      adminPct: rows.length > 0 ? Math.round((adminSent / rows.length) * 100) : 0,
      total: rows.length, mean: Math.round(mean) } };
  },

  async rawList(companyId, fromISO = null, toISO = null) {
    const _all   = window.allUsers || (typeof allUsers !== 'undefined' ? allUsers : []);
    const nameOf = {}, deptOf = {};
    _all.forEach(u => {
      nameOf[u.__backendId] = u.name  || u.email || u.__backendId;
      deptOf[u.__backendId] = u.department || 'Sin área';
    });
    const rows = await this._fetch(companyId, fromISO, toISO);
    const MARKER = '[allay_private]';
    return { isOk: true, data: rows.map(r => ({
      id:        r.id,
      createdAt: r.created_at,
      from:      nameOf[r.from_user_id] || r.from_user_id,
      fromDept:  deptOf[r.from_user_id] || '',
      to:        nameOf[r.to_user_id]   || r.to_user_id,
      toDept:    deptOf[r.to_user_id]   || '',
      program:   r.program || '',
      points:    r.points  || 0,
      message:   (r.message || '').replace(/\n?\[allay_private\]/g, '').trim(),
      isPrivate: r.is_private === true || (r.message || '').includes(MARKER),
    }))};
  },

  async byUser(companyId, fromISO = null, toISO = null) {
    const _all  = window.allUsers || (typeof allUsers !== 'undefined' ? allUsers : []);
    const rows  = await this._fetch(companyId, fromISO, toISO);
    const users = _all.filter(u =>
      u.role !== 'superadmin' && (companyId ? u.company_id === companyId : true)
    );

    const map = {};
    users.forEach(u => {
      map[u.__backendId] = { id: u.__backendId, name: u.name || u.email, email: u.email || '', dept: u.department || 'Sin área', sent: 0, received: 0, pointsReceived: 0 };
    });
    rows.forEach(r => {
      if (map[r.from_user_id]) map[r.from_user_id].sent++;
      if (map[r.to_user_id])   { map[r.to_user_id].received++; map[r.to_user_id].pointsReceived += (r.points || 0); }
    });

    const all            = Object.values(map);
    const byReceived     = [...all].sort((a, b) => b.received - a.received);
    const mostRecognized = byReceived.filter(u => u.received > 0).slice(0, 5);
    const leastRecognized= byReceived.filter(u => u.received > 0).reverse().slice(0, 5);
    const inactive       = all.filter(u => u.sent === 0 && u.received === 0);
    const topChart       = [...all].sort((a, b) => (b.received + b.sent) - (a.received + a.sent)).slice(0, 10);

    return { isOk: true, data: { all, mostRecognized, leastRecognized, inactive, topChart } };
  },

  async byProgram(companyId, fromISO = null, toISO = null) {
    const rows     = await this._fetchPrograms(companyId, fromISO, toISO);
    const allProgs = window.companyPrograms || (typeof companyPrograms !== 'undefined' ? companyPrograms : []);
    const active   = allProgs.filter(p => !p.pending && p.active !== false);

    // Count recognitions per program label
    const countMap = {};
    for (const r of rows) { if (r.program) countMap[r.program] = (countMap[r.program] || 0) + 1; }

    // Build distribution from active programs
    const knownLabels = new Set();
    const distribution = active.map(p => {
      const label = `${p.emoji} ${p.name}`;
      knownLabels.add(label);
      return { label, emoji: p.emoji, name: p.name, count: countMap[label] || 0, isCustom: !!p.custom };
    });

    // Include historical labels not in active programs
    for (const [label, count] of Object.entries(countMap)) {
      if (!knownLabels.has(label)) {
        distribution.push({ label, emoji: label.split(' ')[0] || '📋', name: label, count, isCustom: false });
      }
    }
    distribution.sort((a, b) => b.count - a.count);

    const total       = distribution.reduce((s, d) => s + d.count, 0);
    const withActivity = distribution.filter(d => d.count > 0);
    const top         = withActivity[0]  || null;
    const least       = withActivity.length > 1 ? withActivity[withActivity.length - 1] : null;
    const unused      = distribution.filter(d => d.count === 0);

    return { isOk: true, data: { distribution, total, top, least, unused, withActivity } };
  },

  async teamInteraction(companyId, fromISO = null, toISO = null) {
    const _all  = window.allUsers || (typeof allUsers !== 'undefined' ? allUsers : []);
    const rows  = await this._fetch(companyId, fromISO, toISO);
    const users = _all.filter(u =>
      u.role !== 'superadmin' && (companyId ? u.company_id === companyId : true)
    );

    const deptOf = {};
    for (const u of users) deptOf[u.__backendId] = u.department || 'Sin área';
    const depts = [...new Set(users.map(u => u.department || 'Sin área'))].sort();

    // Build NxN matrix [fromDept][toDept] = count
    const matrix = {};
    for (const d of depts) { matrix[d] = {}; for (const d2 of depts) matrix[d][d2] = 0; }
    for (const r of rows) {
      const fd = deptOf[r.from_user_id], td = deptOf[r.to_user_id];
      if (fd && td && matrix[fd] !== undefined) matrix[fd][td]++;
    }

    // Max value across cross-team cells (exclude diagonal)
    let maxVal = 1;
    for (const d of depts)
      for (const d2 of depts)
        if (d !== d2 && matrix[d][d2] > maxVal) maxVal = matrix[d][d2];

    // Cross-team totals per dept
    const teamStats = depts.map(d => {
      const sent     = depts.filter(d2 => d2 !== d).reduce((s, d2) => s + matrix[d][d2], 0);
      const received = depts.filter(d2 => d2 !== d).reduce((s, d2) => s + matrix[d2][d], 0);
      return { dept: d, sent, received, total: sent + received };
    }).sort((a, b) => b.total - a.total);

    const isolated = teamStats.filter(t => t.total === 0).map(t => t.dept);

    return { isOk: true, data: { depts, matrix, maxVal, teamStats, isolated } };
  },

  async engagement(companyId, fromISO = null, toISO = null, department = '') {
    const _all     = window.allUsers || (typeof allUsers !== 'undefined' ? allUsers : []);
    const rows     = await this._fetch(companyId, fromISO, toISO);
    const allU     = _all.filter(u =>
      u.role !== 'superadmin' && (companyId ? u.company_id === companyId : true)
    );
    const users    = department ? allU.filter(u => u.department === department) : allU;
    const totalUsers  = users.length;
    const userIds     = new Set(users.map(u => u.__backendId));
    const senderIds   = new Set(rows.map(r => r.from_user_id).filter(id => userIds.has(id)));
    const receiverIds = new Set(rows.map(r => r.to_user_id).filter(id => userIds.has(id)));
    const sentByUser  = rows.filter(r => userIds.has(r.from_user_id)).length;

    const pctSenders   = totalUsers > 0 ? Math.round((senderIds.size   / totalUsers) * 100) : 0;
    const pctReceivers = totalUsers > 0 ? Math.round((receiverIds.size / totalUsers) * 100) : 0;
    const avgPerUser   = totalUsers > 0 ? (sentByUser / totalUsers).toFixed(1) : '0.0';

    // Department breakdown always uses full company (not dept-filtered)
    const deptMap = {};
    for (const u of allU) {
      const d = u.department || 'Sin área';
      if (!deptMap[d]) deptMap[d] = { dept: d, total: 0, senders: new Set(), receivers: new Set() };
      deptMap[d].total++;
    }
    for (const r of rows) {
      const fu = allU.find(u => u.__backendId === r.from_user_id);
      const tu = allU.find(u => u.__backendId === r.to_user_id);
      if (fu) { const d = fu.department || 'Sin área'; deptMap[d]?.senders.add(r.from_user_id); }
      if (tu) { const d = tu.department || 'Sin área'; deptMap[d]?.receivers.add(r.to_user_id); }
    }
    const deptStats = Object.values(deptMap).map(d => ({
      dept:        d.dept,
      total:       d.total,
      senderPct:   d.total > 0 ? Math.round((d.senders.size   / d.total) * 100) : 0,
      receiverPct: d.total > 0 ? Math.round((d.receivers.size / d.total) * 100) : 0,
    })).sort((a, b) => a.senderPct - b.senderPct);

    // Users with no activity in the filtered set
    const lowParticipation = users.filter(u =>
      !senderIds.has(u.__backendId) && !receiverIds.has(u.__backendId)
    );

    // Monthly evolution (% of full company users)
    const evolIds   = new Set(allU.map(u => u.__backendId));
    const evolTotal = allU.length;
    const periodMap = {};
    for (const r of rows) {
      const p = r.created_at.substring(0, 7);
      if (!periodMap[p]) periodMap[p] = { period: p, senders: new Set(), receivers: new Set() };
      if (evolIds.has(r.from_user_id)) periodMap[p].senders.add(r.from_user_id);
      if (evolIds.has(r.to_user_id))   periodMap[p].receivers.add(r.to_user_id);
    }
    const evolution = Object.values(periodMap)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(p => ({
        period:      p.period,
        senderPct:   evolTotal > 0 ? Math.round((p.senders.size   / evolTotal) * 100) : 0,
        receiverPct: evolTotal > 0 ? Math.round((p.receivers.size / evolTotal) * 100) : 0,
      }));

    return { isOk: true, data: { pctSenders, pctReceivers, avgPerUser, deptStats, lowParticipation, evolution, totalUsers } };
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
      if (error) { _log('image upload error:', error.message); return { isOk: false }; }
      const { data: { publicUrl } } = _sb.storage.from('comment-images').getPublicUrl(path);
      return { isOk: true, url: publicUrl };
    } catch (e) {
      _log('storageSdk upload exception:', e);
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
      _log('uploadRecognitionImage exception:', e);
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
    if (error) _log('redemptions list error:', error.message);
    return { isOk: !error, data: data || [] };
  }
};
