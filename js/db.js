// db.js — слой данных Supabase (v2)
// Ходим в Supabase напрямую (CORS у проекта = *). Работает из любого origin —
// хоть с Мака, хоть со статического хостинга.
const SUPABASE_URL = 'https://mkehzkobjxnjobkqeiwt.supabase.co';
const SUPABASE_ANON = 'sb_publishable_4RVlpOkywKmEjsnKsHpRiA_q_Af-f0v';
// если SDK не загрузился (плохая сеть / кеш) — не падаем, а показываем понятную ошибку
const sb = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null;

// гость читает людей из маскированной view (телефоны/почты = ******)
let peopleSource = 'people';
function setPeopleSource(role) { peopleSource = (role === 'guest') ? 'people_guest' : 'people'; }

// ---------- маппинг camelCase (приложение) <-> snake_case (БД) ----------
function fromClinic(r) {
  return {
    id: r.id, name: r.name, type: r.type, region: r.region, city: r.city,
    manager: r.manager, linkedClinicId: r.linked_clinic_id, kind: r.kind || 'hospital',
    situation: r.situation, tags: r.tags || [], updatedAt: r.updated_at,
    markedDel: r.marked_del || false,
    sales2021: r.sales_2021, sales2022: r.sales_2022, sales2023: r.sales_2023,
    sales2024: r.sales_2024, sales2025: r.sales_2025, sales2026: r.sales_2026,
    hugemed2025: r.hugemed_2025, hugemed2026: r.hugemed_2026
  };
}
function toClinic(row) {
  const r = {
    name: row.name, type: row.type, region: row.region, city: row.city,
    manager: row.manager, linked_clinic_id: row.linkedClinicId,
    situation: row.situation, tags: row.tags || []
  };
  if (row.kind === 'distributor') r.kind = 'distributor';
  r.sales_2021 = row.sales2021 ?? null;
  r.sales_2022 = row.sales2022 ?? null;
  r.sales_2023 = row.sales2023 ?? null;
  r.sales_2024 = row.sales2024 ?? null;
  r.sales_2025 = row.sales2025 ?? null;
  r.sales_2026 = row.sales2026 ?? null;
  r.hugemed_2025 = row.hugemed2025 ?? null;
  r.hugemed_2026 = row.hugemed2026 ?? null;
  return r;
}
function fromPerson(r) {
  return {
    id: r.id, fullName: r.full_name, clinicId: r.clinic_id, position: r.position,
    region: r.region, city: r.city, phone: r.phone, email: r.email,
    situation: r.situation, tags: r.tags || [], updatedAt: r.updated_at,
    markedDel: r.marked_del || false
  };
}
function toPerson(row) {
  const r = {
    full_name: row.fullName, clinic_id: row.clinicId,
    region: row.region, city: row.city, phone: row.phone, email: row.email,
    situation: row.situation, tags: row.tags || []
  };
  if (row.position) r.position = row.position;
  return r;
}

// ---------- справочники ----------
async function getDict(type) {
  const { data, error } = await sb.from('dicts').select('value').eq('type', type).order('value');
  if (error) throw error;
  return (data || []).map(d => d.value);
}

async function addDictValues(type, values) {
  const clean = [...new Set((values || []).map(v => (v || '').trim()).filter(Boolean))];
  if (!clean.length) return;
  const { error } = await sb.from('dicts')
    .upsert(clean.map(v => ({ type, value: v })), { onConflict: 'type,value' });
  if (error) throw error;
}

async function addDictValue(type, value) { await addDictValues(type, [value]); }

async function deleteDictValue(type, value) {
  const { error } = await sb.from('dicts').delete().eq('type', type).eq('value', value);
  if (error) throw error;
}

// ---------- клиники ----------
async function listClinics() {
  const { data, error } = await sb.from('clinics').select('*').order('name');
  if (error) throw error;
  return (data || []).map(fromClinic);
}
async function getClinic(id) {
  const { data, error } = await sb.from('clinics').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? fromClinic(data) : null;
}
async function addClinic(row) {
  const { data, error } = await sb.from('clinics').insert(toClinic(row)).select().single();
  if (error) throw error;
  return fromClinic(data);
}
async function updateClinic(id, row) {
  const { error } = await sb.from('clinics').update(toClinic(row)).eq('id', id);
  if (error) throw error;
}
async function removeClinic(id) {
  const { error } = await sb.from('clinics').delete().eq('id', id);
  if (error) throw error;
}
async function setClinicMarked(id, val) {
  const { error } = await sb.from('clinics').update({ marked_del: !!val }).eq('id', id);
  if (error) throw error;
}

// ---------- люди ----------
async function listPeople() {
  const { data, error } = await sb.from(peopleSource).select('*').order('full_name');
  if (error) throw error;
  return (data || []).map(fromPerson);
}
async function getPerson(id) {
  const { data, error } = await sb.from(peopleSource).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? fromPerson(data) : null;
}
async function addPerson(row) {
  const { data, error } = await sb.from('people').insert(toPerson(row)).select().single();
  if (error) throw error;
  return fromPerson(data);
}
async function updatePerson(id, row) {
  const { error } = await sb.from('people').update(toPerson(row)).eq('id', id);
  if (error) throw error;
}
async function removePerson(id) {
  const { error } = await sb.from('people').delete().eq('id', id);
  if (error) throw error;
}
async function setPersonMarked(id, val) {
  const { error } = await sb.from('people').update({ marked_del: !!val }).eq('id', id);
  if (error) throw error;
}
async function peopleByClinic(clinicId) {
  const { data, error } = await sb.from(peopleSource).select('*').eq('clinic_id', clinicId).order('full_name');
  if (error) throw error;
  return (data || []).map(fromPerson);
}
async function clearPeopleClinic(clinicId) {
  const { error } = await sb.from('people').update({ clinic_id: null }).eq('clinic_id', clinicId);
  if (error) throw error;
}

// точечное обновление комментария (инлайн-редактирование)
async function setSituation(table, id, text) {
  const { error } = await sb.from(table).update({ situation: text }).eq('id', id);
  if (error) throw error;
}

// точечное обновление суммы продаж за год (вкладка «Деньги»)
async function setSalesYear(id, year, value) {
  const col = 'sales_' + year;
  const { error } = await sb.from('clinics').update({ [col]: value }).eq('id', id);
  if (error) throw error;
}

// ---------- auth ----------
async function currentUser() {
  const { data } = await sb.auth.getUser();
  return data.user;
}
async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}
async function signOut() { await sb.auth.signOut(); }
