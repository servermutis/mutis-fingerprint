import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Spinner from '../../components/Spinner';
import { ROLE_LABEL } from '../../utils/format';

const TABS = ['Unit', 'Mesin', 'Jadwal', 'Pengguna'];

function Notice({ children }) {
  return (
    <p className="mb-4 border-l-2 border-gold bg-gold-soft px-3 py-2 text-xs text-ink-soft">{children}</p>
  );
}

function UnitTab() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: '', name: '' });
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase.from('units').select('*').order('name');
    if (err) setError(err.message);
    else setUnits(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase.from('units').insert(form);
    if (err) return setError(err.message);
    setForm({ code: '', name: '' });
    load();
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-5 flex flex-wrap items-end gap-3 border border-line bg-paper-soft p-4">
        <div>
          <label className="block text-xs text-ink-faint">Kode</label>
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="SDIT"
            className="mt-1 border border-line bg-white px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Nama Unit</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="SD Islam Terpadu"
            className="mt-1 border border-line bg-white px-2 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="border border-ink px-3 py-1.5 text-sm text-ink hover:bg-ink hover:text-paper">
          Tambah Unit
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-status-alpha">{error}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <table className="w-full max-w-lg border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left text-ink-soft">
              <th className="py-2 pr-4 font-medium">Kode</th>
              <th className="py-2 font-medium">Nama</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className="border-b border-line">
                <td className="py-2 pr-4">{u.code}</td>
                <td className="py-2">{u.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MesinTab() {
  const [devices, setDevices] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ serial_number: '', name: '', unit_id: '', ip_address: '', location: '' });
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase.from('devices').select('*, units(name)').order('name');
    if (err) setError(err.message);
    else setDevices(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from('units').select('id, name').then(({ data }) => setUnits(data || []));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    const payload = { ...form, unit_id: form.unit_id || null };
    const { error: err } = await supabase.from('devices').insert(payload);
    if (err) return setError(err.message);
    setForm({ serial_number: '', name: '', unit_id: '', ip_address: '', location: '' });
    load();
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-5 grid gap-3 border border-line bg-paper-soft p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input required placeholder="Serial Number (SN)" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm" />
        <input required placeholder="Nama mesin" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm" />
        <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm">
          <option value="">Unit (opsional)</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input placeholder="Alamat IP" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm" />
        <input placeholder="Lokasi" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm" />
        <button type="submit" className="border border-ink px-3 py-1.5 text-sm text-ink hover:bg-ink hover:text-paper lg:col-span-5 lg:w-fit">
          Tambah Mesin
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-status-alpha">{error}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left text-ink-soft">
              <th className="py-2 pr-4 font-medium">Nama</th>
              <th className="py-2 pr-4 font-medium">SN</th>
              <th className="py-2 pr-4 font-medium">Unit</th>
              <th className="py-2 pr-4 font-medium">IP</th>
              <th className="py-2 font-medium">Terakhir Terlihat</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-b border-line">
                <td className="py-2 pr-4">{d.name}</td>
                <td className="py-2 pr-4 tabular-nums">{d.serial_number}</td>
                <td className="py-2 pr-4">{d.units?.name || '-'}</td>
                <td className="py-2 pr-4 tabular-nums">{d.ip_address || '-'}</td>
                <td className="py-2 text-ink-faint">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString('id-ID') : 'Belum pernah'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function JadwalTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    type: 'reguler_kantor',
    jam_masuk: '07:00',
    jam_pulang: '15:00',
    toleransi_terlambat_menit: 10,
    toleransi_pulang_cepat_menit: 0,
  });
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase.from('schedule_templates').select('*').order('name');
    if (err) setError(err.message);
    else setTemplates(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase.from('schedule_templates').insert(form);
    if (err) return setError(err.message);
    setForm({ ...form, name: '' });
    load();
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-5 grid gap-3 border border-line bg-paper-soft p-4 sm:grid-cols-2 lg:grid-cols-3">
        <input required placeholder="Nama jadwal" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm">
          <option value="reguler_kantor">Reguler Kantor</option>
          <option value="mengajar">Mengajar</option>
          <option value="piket">Piket</option>
        </select>
        <div />
        <div>
          <label className="block text-xs text-ink-faint">Jam Masuk</label>
          <input type="time" value={form.jam_masuk} onChange={(e) => setForm({ ...form, jam_masuk: e.target.value })} className="mt-1 w-full border border-line bg-white px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Jam Pulang</label>
          <input type="time" value={form.jam_pulang} onChange={(e) => setForm({ ...form, jam_pulang: e.target.value })} className="mt-1 w-full border border-line bg-white px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Toleransi Telat (mnt)</label>
          <input type="number" min="0" value={form.toleransi_terlambat_menit} onChange={(e) => setForm({ ...form, toleransi_terlambat_menit: Number(e.target.value) })} className="mt-1 w-full border border-line bg-white px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" className="border border-ink px-3 py-1.5 text-sm text-ink hover:bg-ink hover:text-paper lg:col-span-3 lg:w-fit">
          Tambah Jadwal
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-status-alpha">{error}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left text-ink-soft">
              <th className="py-2 pr-4 font-medium">Nama</th>
              <th className="py-2 pr-4 font-medium">Tipe</th>
              <th className="py-2 pr-4 font-medium">Masuk</th>
              <th className="py-2 pr-4 font-medium">Pulang</th>
              <th className="py-2 font-medium">Toleransi Telat</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-line">
                <td className="py-2 pr-4">{t.name}</td>
                <td className="py-2 pr-4 text-ink-faint">{t.type}</td>
                <td className="py-2 pr-4 tabular-nums">{t.jam_masuk}</td>
                <td className="py-2 pr-4 tabular-nums">{t.jam_pulang}</td>
                <td className="py-2 tabular-nums">{t.toleransi_terlambat_menit} mnt</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PenggunaTab() {
  const [profiles, setProfiles] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newForm, setNewForm] = useState({
    id: '', nip: '', full_name: '', role: 'guru', employment_type: 'guru', unit_id: '', device_user_pin: '',
  });
  const [addError, setAddError] = useState(null);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase.from('profiles').select('*, units(name)').order('full_name');
    if (err) setError(err.message);
    else setProfiles(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from('units').select('id, name').then(({ data }) => setUnits(data || []));
  }, []);

  function startEdit(p) {
    setEditingId(p.id);
    setEditForm({
      role: p.role,
      unit_id: p.unit_id || '',
      device_user_pin: p.device_user_pin || '',
      is_active: p.is_active,
    });
  }

  async function saveEdit(id) {
    const { error: err } = await supabase
      .from('profiles')
      .update({ ...editForm, unit_id: editForm.unit_id || null })
      .eq('id', id);
    if (err) return alert(`Gagal menyimpan: ${err.message}`);
    setEditingId(null);
    load();
  }

  async function handleAddProfile(e) {
    e.preventDefault();
    setAddError(null);
    const payload = { ...newForm, unit_id: newForm.unit_id || null };
    const { error: err } = await supabase.from('profiles').insert(payload);
    if (err) return setAddError(err.message);
    setNewForm({ id: '', nip: '', full_name: '', role: 'guru', employment_type: 'guru', unit_id: '', device_user_pin: '' });
    load();
  }

  return (
    <div>
      <Notice>
        Membuat akun login baru harus dilakukan lewat Supabase Auth terlebih dahulu (dashboard Supabase
        atau fitur admin), karena membuat akun butuh <code>service_role</code> key yang tidak boleh
        dipakai di browser. Setelah akun dibuat, salin User ID (UUID)-nya lalu lengkapi profilnya di sini.
      </Notice>

      <form onSubmit={handleAddProfile} className="mb-6 grid gap-3 border border-line bg-paper-soft p-4 sm:grid-cols-2 lg:grid-cols-3">
        <input required placeholder="User ID (UUID dari Supabase Auth)" value={newForm.id} onChange={(e) => setNewForm({ ...newForm, id: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm lg:col-span-2" />
        <input placeholder="NIP/NIK" value={newForm.nip} onChange={(e) => setNewForm({ ...newForm, nip: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm" />
        <input required placeholder="Nama lengkap" value={newForm.full_name} onChange={(e) => setNewForm({ ...newForm, full_name: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm" />
        <select value={newForm.role} onChange={(e) => setNewForm({ ...newForm, role: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm">
          <option value="guru">Guru</option>
          <option value="pegawai">Pegawai</option>
          <option value="admin">Admin</option>
          <option value="pimpinan">Pimpinan</option>
        </select>
        <select value={newForm.unit_id} onChange={(e) => setNewForm({ ...newForm, unit_id: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm">
          <option value="">Unit (opsional)</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input placeholder="PIN mesin fingerprint" value={newForm.device_user_pin} onChange={(e) => setNewForm({ ...newForm, device_user_pin: e.target.value })} className="border border-line bg-white px-2 py-1.5 text-sm" />
        {addError && <p className="text-sm text-status-alpha lg:col-span-3">{addError}</p>}
        <button type="submit" className="border border-ink px-3 py-1.5 text-sm text-ink hover:bg-ink hover:text-paper lg:col-span-3 lg:w-fit">
          Lengkapi Profil
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-status-alpha">{error}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left text-ink-soft">
              <th className="py-2 pr-4 font-medium">Nama</th>
              <th className="py-2 pr-4 font-medium">Peran</th>
              <th className="py-2 pr-4 font-medium">Unit</th>
              <th className="py-2 pr-4 font-medium">PIN Mesin</th>
              <th className="py-2 pr-4 font-medium">Aktif</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-line align-top">
                <td className="py-2 pr-4">{p.full_name}</td>
                {editingId === p.id ? (
                  <>
                    <td className="py-2 pr-4">
                      <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="border border-line bg-white px-2 py-1 text-sm">
                        <option value="guru">Guru</option>
                        <option value="pegawai">Pegawai</option>
                        <option value="admin">Admin</option>
                        <option value="pimpinan">Pimpinan</option>
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <select value={editForm.unit_id} onChange={(e) => setEditForm({ ...editForm, unit_id: e.target.value })} className="border border-line bg-white px-2 py-1 text-sm">
                        <option value="">-</option>
                        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <input value={editForm.device_user_pin} onChange={(e) => setEditForm({ ...editForm, device_user_pin: e.target.value })} className="w-24 border border-line bg-white px-2 py-1 text-sm" />
                    </td>
                    <td className="py-2 pr-4">
                      <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} />
                    </td>
                    <td className="py-2">
                      <button onClick={() => saveEdit(p.id)} className="mr-2 text-status-hadir underline">Simpan</button>
                      <button onClick={() => setEditingId(null)} className="text-ink-faint underline">Batal</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-4">{ROLE_LABEL[p.role] || p.role}</td>
                    <td className="py-2 pr-4">{p.units?.name || '-'}</td>
                    <td className="py-2 pr-4 tabular-nums">{p.device_user_pin || '-'}</td>
                    <td className="py-2 pr-4">{p.is_active ? 'Ya' : 'Tidak'}</td>
                    <td className="py-2">
                      <button onClick={() => startEdit(p)} className="text-ink underline hover:text-gold-dark">Ubah</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function MasterData() {
  const [tab, setTab] = useState('Unit');

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink">Data Induk</h1>
        <p className="mt-1 text-sm text-ink-faint">Unit, mesin fingerprint, jadwal kerja, dan pengguna.</p>
      </header>

      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm ${
              tab === t ? 'border-b-2 border-gold font-medium text-ink' : 'text-ink-faint hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Unit' && <UnitTab />}
      {tab === 'Mesin' && <MesinTab />}
      {tab === 'Jadwal' && <JadwalTab />}
      {tab === 'Pengguna' && <PenggunaTab />}
    </div>
  );
}
