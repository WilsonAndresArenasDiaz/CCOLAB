/*
   CCO Service Hub - Lógica V11 (Condiciones de avance, repuestos en solución, visibilidad de almacén)
*/
const STATIONS = ['diagnostico', 'reparacion', 'pruebas', 'limpieza'];
const DEFAULT_PASSWORD = '1234';

// USUARIOS
const DEFAULT_USERS = [
    { id: 1, username: "wilson", password: "admin123", role: "administrador", name: "Wilson Andrés Arenas Díaz", specialty: "Coordinador" },
    { id: 2, username: "diana", password: DEFAULT_PASSWORD, role: "tecnico", name: "Diana Patricia Mendoza Paredes", specialty: "Hardware" },
    { id: 3, username: "oscar", password: DEFAULT_PASSWORD, role: "tecnico", name: "Oscar Julián Riaño Hernández", specialty: "Software" },
    { id: 4, username: "john", password: DEFAULT_PASSWORD, role: "tecnico", name: "John Sebastián Alarcón Arévalo", specialty: "Hardware" },
    { id: 5, username: "jairo", password: DEFAULT_PASSWORD, role: "tecnico", name: "Jairo Cortes Perdomo", specialty: "Generalista" },
    { id: 6, username: "juanc", password: DEFAULT_PASSWORD, role: "tecnico", name: "Juan Carlos Duarte Ramirez", specialty: "Calidad" },
    { id: 7, username: "cristian", password: DEFAULT_PASSWORD, role: "tecnico", name: "Cristian Camilo Garcia Bustos", specialty: "Hardware" },
    { id: 8, username: "richard", password: DEFAULT_PASSWORD, role: "tecnico", name: "Richard Johan Contreras Fonseca", specialty: "Software" },
    { id: 9, username: "riki", password: DEFAULT_PASSWORD, role: "tecnico", name: "Samboni Trujillo Riki Marlon", specialty: "Generalista" },
    { id: 10, username: "jorge", password: DEFAULT_PASSWORD, role: "almacenista", name: "Jorge Delgado", specialty: "Almacenista" }
];

function getTechniciansFromUsers() {
    return DEFAULT_USERS.filter(u => u.role === 'tecnico' || u.role === 'administrador' || u.role === 'coordinador').map(u => ({
        id: u.id,
        name: u.name,
        specialty: u.specialty,
        permissions: (u.role === 'administrador' || u.role === 'coordinador') ? STATIONS : STATIONS.slice(0, 3)
    }));
}

const DEFAULT_TOOLS = [
    { id: 201, name: "Estación de Calor Weller WTHA 1", code: "HER-00102", assignedTo: 1 },
    { id: 202, name: "Multímetro Fluke 87V", code: "HER-00210", assignedTo: 2 },
    { id: 203, name: "Microscopio Kaisi 7050", code: "HER-00305", assignedTo: 3 }
];

// INVENTARIO (pon aquí tu lista completa)
const DEFAULT_INVENTORY_PARTS = [
    { id: 1001, name: "Tarjeta principal", compatibleModels: "UN20", quantity: 10, minStock: 2, location: "Estante A1" },
    { id: 1002, name: "Batería Litio", compatibleModels: "N86,N6,KD69", quantity: 10, minStock: 2, location: "Estante N1" },
    { id: 1003, name: "Puerto USB tipo C", compatibleModels: "N86,N6,KD69", quantity: 10, minStock: 2, location: "Estante Y1" },
    // ... (agrega el resto)
];

// ESTADO GLOBAL
let repairOrders = [];
let inventoryParts = [];
let technicians = [];
let tools = [];
let users = [];
let currentUser = null;
let activeTechIdFilter = null;
let assignedStock = [];
let dailyConsumption = [];
let solutionDB = [];
let stationAssignments = {};
let cleaningTimers = {};
let cleaningSeconds = 0;
let currentCleaningOrderId = null;
let currentEntryOrderId = null;

// FUNCIONES DE CARGA
function loadUsers() { const s = localStorage.getItem('ccohub_users'); users = s ? JSON.parse(s) : [...DEFAULT_USERS]; localStorage.setItem('ccohub_users', JSON.stringify(users)); }
function loadTechnicians() { technicians = getTechniciansFromUsers(); localStorage.setItem('ccohub_technicians', JSON.stringify(technicians)); }
function loadTools() { const s = localStorage.getItem('ccohub_tools'); tools = s ? JSON.parse(s) : [...DEFAULT_TOOLS]; localStorage.setItem('ccohub_tools', JSON.stringify(tools)); }
function loadInventory() { const s = localStorage.getItem('ccohub_inventory'); inventoryParts = s ? JSON.parse(s) : [...DEFAULT_INVENTORY_PARTS]; localStorage.setItem('ccohub_inventory', JSON.stringify(inventoryParts)); }
function loadAssignedStock() { const s = localStorage.getItem('ccohub_assigned_stock'); assignedStock = s ? JSON.parse(s) : []; localStorage.setItem('ccohub_assigned_stock', JSON.stringify(assignedStock)); }
function loadDailyConsumption() { const s = localStorage.getItem('ccohub_daily_consumption'); dailyConsumption = s ? JSON.parse(s) : []; localStorage.setItem('ccohub_daily_consumption', JSON.stringify(dailyConsumption)); }
function loadSolutionDB() { const s = localStorage.getItem('ccohub_solutions'); solutionDB = s ? JSON.parse(s) : []; localStorage.setItem('ccohub_solutions', JSON.stringify(solutionDB)); }
function loadStationAssignments() { const s = localStorage.getItem('ccohub_station_assignments'); stationAssignments = s ? JSON.parse(s) : {}; localStorage.setItem('ccohub_station_assignments', JSON.stringify(stationAssignments)); }
function loadRepairOrders() {
    const s = localStorage.getItem('ccohub_repairs');
    if (s) {
        repairOrders = JSON.parse(s);
        repairOrders.forEach(r => {
            if (!r.station || !STATIONS.includes(r.station)) r.station = 'diagnostico';
            if (!r.timeline) r.timeline = { diagnostico: null, reparacion: null, pruebas: null, limpieza: null, completed: null };
            if (!r.photos) r.photos = { entry: null, exit: null };
            if (r.cleaningTime === undefined) r.cleaningTime = 0;
        });
    } else {
        const now = Date.now();
        repairOrders = [{
            id: 1, model: "Nexgo N86", serial: "NX86-001", failureType: "Batería dañada", technicianId: 2, station: "diagnostico",
            notes: "Revisar carga", status: "active", sapPmOrderId: "PM-001", softwareOperation: "Ninguna",
            timeline: { diagnostico: now - 3600000, reparacion: null, pruebas: null, limpieza: null, completed: null },
            checklist: null, solutionId: null, photos: { entry: null, exit: null }, cleaningTime: 0
        }];
        localStorage.setItem('ccohub_repairs', JSON.stringify(repairOrders));
    }
}
function saveRepairOrders() { localStorage.setItem('ccohub_repairs', JSON.stringify(repairOrders)); }
function saveInventoryParts() { localStorage.setItem('ccohub_inventory', JSON.stringify(inventoryParts)); }
function saveTools() { localStorage.setItem('ccohub_tools', JSON.stringify(tools)); }
function saveUsers() { localStorage.setItem('ccohub_users', JSON.stringify(users)); }
function saveAssignedStock() { localStorage.setItem('ccohub_assigned_stock', JSON.stringify(assignedStock)); }
function saveDailyConsumption() { localStorage.setItem('ccohub_daily_consumption', JSON.stringify(dailyConsumption)); }
function saveSolutionDB() { localStorage.setItem('ccohub_solutions', JSON.stringify(solutionDB)); }
function saveStationAssignments() { localStorage.setItem('ccohub_station_assignments', JSON.stringify(stationAssignments)); }

// AUTENTICACIÓN
function login(username, password) {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        sessionStorage.setItem('ccohub_session', JSON.stringify({ userId: user.id, username: user.username, role: user.role }));
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-main').style.display = 'block';
        document.getElementById('display-username').textContent = user.name;
        document.getElementById('display-role').textContent = user.role.toUpperCase();
        applyRolePermissions(user);
        initApp();
        showNotification(`Bienvenido, ${user.name}`);
        return true;
    } else {
        document.getElementById('login-error').style.display = 'block';
        return false;
    }
}
function logout() { sessionStorage.removeItem('ccohub_session'); currentUser = null; location.reload(); }
function checkSession() {
    const session = sessionStorage.getItem('ccohub_session');
    if (session) {
        const data = JSON.parse(session);
        const user = users.find(u => u.id === data.userId);
        if (user) {
            currentUser = user;
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('app-main').style.display = 'block';
            document.getElementById('display-username').textContent = user.name;
            document.getElementById('display-role').textContent = user.role.toUpperCase();
            applyRolePermissions(user);
            return true;
        }
    }
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-main').style.display = 'none';
    return false;
}

function hasPermission(module, action = 'view') {
    if (!currentUser) return false;
    if (currentUser.role === 'administrador') return true;
    const perms = {
        'coordinador': { 'repairs': ['view','create','update','export'], 'inventory': ['view','assign'], 'staff': ['view','edit','assign'], 'tv': ['view'], 'analytics': ['view','export'], 'coordinator': ['view','update'] },
        'tecnico': { 'repairs': ['view','create','update'], 'inventory': ['view'], 'tv': ['view'] },
        'almacenista': { 'inventory': ['view','create','update','delete','assign'], 'tv': ['view'] }
    };
    return perms[currentUser.role]?.[module]?.includes(action) || false;
}
function applyRolePermissions(user) {
    const tabs = {
        'btn-mod-repairs': 'repairs', 'btn-mod-inventory': 'inventory', 'btn-mod-staff': 'staff',
        'btn-mod-tv': 'tv', 'btn-mod-analytics': 'analytics', 'btn-mod-coordinator': 'coordinator'
    };
    for (const [id, module] of Object.entries(tabs)) {
        const el = document.getElementById(id);
        if (el) el.style.display = hasPermission(module, 'view') ? 'flex' : 'none';
    }
    const ap = document.getElementById('assign-stock-panel');
    if (ap) ap.style.display = hasPermission('inventory', 'assign') ? 'block' : 'none';
    const tsp = document.getElementById('tech-stock-panel');
    if (tsp) tsp.style.display = (user.role === 'tecnico') ? 'block' : 'none';
    const prt = document.getElementById('panel-register-tech');
    if (prt) prt.style.display = (user.role === 'administrador' || user.role === 'coordinador') ? 'block' : 'none';
}

function initApp() {
    loadTechnicians(); loadTools(); loadInventory(); loadAssignedStock(); loadDailyConsumption(); loadSolutionDB(); loadStationAssignments(); loadRepairOrders();
    populateTechniciansDropdowns(); populateAssignDropdowns(); populateFilterDropdowns(); populateStationAssignDropdowns();
    updateRepairsMetrics(); renderRepairsPipeline(); renderDiagnostics();
    updateInventoryMetrics(); renderInventoryTable();
    updateStaffMetrics(); renderTechniciansList(); renderToolsTable();
    renderTvDashboard(); renderTechStock(); renderDailyDelivery(); renderCoordinatorView();
    updateLiveTime(); setInterval(updateLiveTime, 1000);
    setInterval(() => {
        if (document.querySelector('#module-repairs.active')) renderRepairsPipeline();
        if (document.querySelector('#module-tv.active')) { renderTvDashboard(); renderDailyDelivery(); checkBottlenecks(); }
        if (document.querySelector('#module-coordinator.active')) renderCoordinatorView();
    }, 30000);
    createIconsSafe();
}

function createIconsSafe() { if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); }
function showNotification(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed; bottom:20px; right:20px; background:var(--grad-brand); color:#000; padding:12px 24px; border-radius:8px; box-shadow:var(--hover-shadow); font-weight:700; z-index:9999; animation:fadeIn 0.3s ease;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
function formatTimeElapsed(ms) {
    if (!ms) return '0 min';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs < 24) return `${hrs}h ${rem}m`;
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h`;
}
function getTechName(id) { const t = technicians.find(t => t.id === id); return t ? t.name : 'Desconocido'; }
function updateLiveTime() {
    const el = document.getElementById('live-time');
    if (el) el.textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function switchModule(name) {
    ['repairs','inventory','staff','tv','analytics','coordinator'].forEach(m => {
        const btn = document.getElementById(`btn-mod-${m}`);
        const view = document.getElementById(`module-${m}`);
        if (btn) btn.classList.remove('active');
        if (view) view.classList.remove('active');
    });
    document.getElementById(`btn-mod-${name}`).classList.add('active');
    document.getElementById(`module-${name}`).classList.add('active');
    if (name === 'repairs') { updateRepairsMetrics(); renderRepairsPipeline(); renderTechStock(); }
    if (name === 'inventory') { updateInventoryMetrics(); renderInventoryTable(); populateAssignDropdowns(); }
    if (name === 'staff') { updateStaffMetrics(); renderTechniciansList(); renderToolsTable(); populateTechniciansDropdowns(); populateStationAssignDropdowns(); }
    if (name === 'tv') { renderTvDashboard(); renderDailyDelivery(); checkBottlenecks(); }
    if (name === 'analytics') { populateFilterDropdowns(); applyFilters(); }
    if (name === 'coordinator') { renderCoordinatorView(); }
    createIconsSafe();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-mod-repairs').onclick = () => switchModule('repairs');
    document.getElementById('btn-mod-inventory').onclick = () => switchModule('inventory');
    document.getElementById('btn-mod-staff').onclick = () => switchModule('staff');
    document.getElementById('btn-mod-tv').onclick = () => switchModule('tv');
    document.getElementById('btn-mod-analytics').onclick = () => switchModule('analytics');
    document.getElementById('btn-mod-coordinator').onclick = () => switchModule('coordinator');
    document.getElementById('login-form').onsubmit = (e) => { e.preventDefault(); login(document.getElementById('login-username').value, document.getElementById('login-password').value); };
    loadUsers();
    if (!checkSession()) { document.getElementById('login-overlay').style.display = 'flex'; document.getElementById('app-main').style.display = 'none'; }
    // Eventos
    document.getElementById('inventory-search').oninput = (e) => renderInventoryTable(document.querySelector('#inventory-filters .tab-btn.active').dataset.filter, e.target.value);
    document.querySelectorAll('#inventory-filters .tab-btn').forEach(b => b.onclick = function() { document.querySelectorAll('#inventory-filters .tab-btn').forEach(x => x.classList.remove('active')); this.classList.add('active'); renderInventoryTable(this.dataset.filter, document.getElementById('inventory-search').value); });
    document.getElementById('diagnostic-input').oninput = (e) => renderDiagnostics(e.target.value);
    document.getElementById('inventory-form').onsubmit = function(e) {
        e.preventDefault();
        const idx = parseInt(document.getElementById('inv-edit-index').value);
        const data = { name: document.getElementById('part-name').value.trim(), compatibleModels: document.getElementById('part-model').value.trim(), quantity: parseInt(document.getElementById('part-qty').value), minStock: parseInt(document.getElementById('part-min').value), location: document.getElementById('part-location').value.trim() };
        if (idx >= 0) { inventoryParts[idx] = { ...inventoryParts[idx], ...data }; showNotification('Actualizado'); }
        else { inventoryParts.push({ id: Date.now(), ...data }); showNotification('Guardado'); }
        saveInventoryParts(); this.reset(); document.getElementById('inv-edit-index').value = '-1'; document.getElementById('inv-submit-btn').innerHTML = '<i data-lucide="save"></i> Guardar'; document.getElementById('inv-cancel-btn').style.display = 'none';
        updateInventoryMetrics(); renderInventoryTable(); populateAssignDropdowns();
    };
    document.getElementById('inv-cancel-btn').onclick = function() { document.getElementById('inventory-form').reset(); document.getElementById('inv-edit-index').value = '-1'; document.getElementById('inv-submit-btn').innerHTML = '<i data-lucide="save"></i> Guardar'; this.style.display = 'none'; };

    // FORMULARIO DE INGRESO - ASIGNA TÉCNICO ACTUAL SI ES TÉCNICO
    document.getElementById('repair-form').onsubmit = function(e) {
        e.preventDefault();
        let technicianId = parseInt(document.getElementById('eq-tech-assign').value);
        if (currentUser && currentUser.role === 'tecnico') {
            technicianId = currentUser.id;
        }
        const station = document.getElementById('eq-station').value || 'diagnostico';
        const data = {
            id: Date.now(),
            model: document.getElementById('eq-model').value,
            serial: document.getElementById('eq-serial').value.trim(),
            failureType: document.getElementById('eq-failure-type').value,
            technicianId: technicianId,
            station: station,
            notes: document.getElementById('eq-notes').value.trim(),
            sapPmOrderId: document.getElementById('eq-sap-id').value.trim() || 'Pendiente',
            softwareOperation: 'Ninguna',
            status: 'active',
            timeline: { diagnostico: null, reparacion: null, pruebas: null, limpieza: null, completed: null },
            checklist: null,
            solutionId: null,
            photos: { entry: null, exit: null },
            cleaningTime: 0
        };
        data.timeline[data.station] = Date.now();
        if (repairOrders.find(r => r.serial === data.serial && r.status === 'active')) { alert('Serial ya en proceso'); return; }
        repairOrders.push(data);
        saveRepairOrders();
        this.reset();
        if (currentUser && currentUser.role === 'tecnico') {
            const sel = document.getElementById('eq-tech-assign');
            sel.value = currentUser.id;
            sel.disabled = true;
        }
        updateRepairsMetrics();
        renderRepairsPipeline();
        showNotification('Equipo ingresado a ' + station.toUpperCase());
    };

    document.getElementById('tech-form').onsubmit = function(e) {
        e.preventDefault();
        const editId = document.getElementById('tech-edit-id').value;
        const name = document.getElementById('tech-name').value.trim();
        const specialty = document.getElementById('tech-specialty').value;
        if (editId) { const u = users.find(x => x.id === parseInt(editId)); if (u) { u.name = name; u.specialty = specialty; saveUsers(); loadTechnicians(); showNotification('Actualizado'); } }
        else { users.push({ id: Date.now(), username: name.toLowerCase().replace(/\s/g,''), password: DEFAULT_PASSWORD, role: 'tecnico', name, specialty }); saveUsers(); loadTechnicians(); showNotification('Registrado'); }
        this.reset(); document.getElementById('tech-edit-id').value = ''; document.getElementById('tech-submit-btn').innerHTML = '<i data-lucide="user-check"></i> Registrar'; document.getElementById('tech-cancel-btn').style.display = 'none';
        updateStaffMetrics(); populateTechniciansDropdowns(); renderTechniciansList(); populateAssignDropdowns(); populateFilterDropdowns(); populateStationAssignDropdowns();
    };
    document.getElementById('tech-cancel-btn').onclick = function() { document.getElementById('tech-form').reset(); document.getElementById('tech-edit-id').value = ''; document.getElementById('tech-submit-btn').innerHTML = '<i data-lucide="user-check"></i> Registrar'; this.style.display = 'none'; };
    document.getElementById('tool-form').onsubmit = function(e) {
        e.preventDefault();
        tools.push({ id: Date.now(), name: document.getElementById('tool-name').value.trim(), code: document.getElementById('tool-code').value.trim(), assignedTo: parseInt(document.getElementById('tool-tech').value) });
        saveTools(); this.reset(); showNotification('Herramienta asignada'); updateStaffMetrics(); renderToolsTable(); renderTechniciansList();
    };
    document.querySelectorAll('#module-tv .checkbox-item input').forEach(chk => chk.onchange = update5SStatus);
});

// FUNCIONES DE RENDERIZADO
function populateTechniciansDropdowns() {
    ['eq-tech-assign', 'tool-tech'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="" disabled selected>Selecciona...</option>';
        technicians.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); });
    });
    if (currentUser && currentUser.role === 'tecnico') {
        const sel = document.getElementById('eq-tech-assign');
        if (sel) {
            sel.value = currentUser.id;
            sel.disabled = true;
        }
    }
    if (activeTechIdFilter) { const sel = document.getElementById('eq-tech-assign'); if (sel) { sel.value = activeTechIdFilter; sel.disabled = true; } }
}
function populateAssignDropdowns() {
    const techSel = document.getElementById('assign-tech'); const partSel = document.getElementById('assign-part');
    if (techSel) { techSel.innerHTML = '<option value="" disabled selected>Selecciona...</option>'; technicians.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; techSel.appendChild(o); }); }
    if (partSel) { partSel.innerHTML = '<option value="" disabled selected>Selecciona...</option>'; inventoryParts.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.name} (${p.quantity})`; partSel.appendChild(o); }); }
}
function populateFilterDropdowns() {
    const sel = document.getElementById('filter-tech');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todos</option>';
    technicians.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); });
}
function populateStationAssignDropdowns() {
    const sel = document.getElementById('station-assign-tech');
    if (!sel) return;
    sel.innerHTML = '<option value="" disabled selected>Selecciona...</option>';
    technicians.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); });
}

function updateRepairsMetrics() {
    const counts = { diagnostico: 0, reparacion: 0, pruebas: 0, limpieza: 0 };
    let active = repairOrders.filter(r => r.status === 'active');
    if (activeTechIdFilter) active = active.filter(r => r.technicianId === activeTechIdFilter);
    active.forEach(r => { if (counts[r.station] !== undefined) counts[r.station]++; });
    document.getElementById('metric-recibo').textContent = counts.diagnostico;
    document.getElementById('metric-taller').textContent = counts.reparacion;
    document.getElementById('metric-software').textContent = counts.pruebas + counts.limpieza;
    const total = active.length, fin = counts.limpieza;
    document.getElementById('metric-repairs-eff').textContent = total > 0 ? Math.round((fin/total)*100) + '%' : '100%';
    STATIONS.forEach(s => {
        const el = document.getElementById(`count-${s}`); if (el) el.textContent = counts[s] || 0;
        const lane = document.getElementById(`lane-${s}`);
        if (lane) {
            if (counts[s] > 1) { lane.classList.add('lane-wip-warning'); if (!lane.querySelector('.wip-alert-text')) { const d = document.createElement('div'); d.className = 'wip-alert-text'; d.style.cssText = 'color:var(--danger); font-size:10px; font-weight:700; text-align:center; margin:5px 0;'; d.innerHTML = '⚠️ EXCESO WIP (>1)'; lane.querySelector('.lane-header').insertAdjacentElement('afterend', d); } }
            else { lane.classList.remove('lane-wip-warning'); const d = lane.querySelector('.wip-alert-text'); if (d) d.remove(); }
        }
    });
}

function renderRepairsPipeline() {
    STATIONS.forEach(s => { const el = document.getElementById(`cards-${s}`); if(el) el.innerHTML = ''; });
    
    let active = repairOrders.filter(r => r.status === 'active');
    if (currentUser && currentUser.role === 'tecnico') {
        active = active.filter(r => r.technicianId === currentUser.id);
    }
    if (activeTechIdFilter) {
        active = active.filter(r => r.technicianId === activeTechIdFilter);
    }
    active.sort((a, b) => STATIONS.indexOf(a.station) - STATIONS.indexOf(b.station));
    
    active.forEach((repair) => {
        const absIdx = repairOrders.indexOf(repair);
        const lane = document.getElementById(`cards-${repair.station}`);
        if (!lane) return;
        const tech = technicians.find(t => t.id === repair.technicianId);
        const techName = tech ? tech.name : 'Sin asignar';
        const ts = repair.timeline[repair.station] || Date.now();
        const stay = formatTimeElapsed(Date.now() - ts);
        const currentIdx = STATIONS.indexOf(repair.station);
        const hasPrev = currentIdx > 0;
        const hasNext = currentIdx < STATIONS.length - 1;

        // Estado de fotos
        let photoBadge = '';
        if (repair.station === 'diagnostico') {
            photoBadge = repair.photos.entry ? '<span class="photo-badge">📸 Llegada OK</span>' : '<span class="photo-badge missing">📸 Sin foto llegada</span>';
        }
        if (repair.station === 'limpieza') {
            photoBadge = repair.photos.exit ? '<span class="photo-badge">📸 Salida OK</span>' : '<span class="photo-badge missing">📸 Sin foto salida</span>';
        }

        // CONDICIONES PARA BOTÓN "AVANZAR" o "ENTREGAR"
        let canAdvance = false;
        let advanceLabel = 'Avanzar';
        let advanceAction = `moveEquipment(${absIdx}, 1)`;
        let extraBtns = '';

        if (repair.station === 'diagnostico') {
            const checklistOk = repair.checklist && repair.checklist.passed === true;
            const photoOk = repair.photos.entry !== null;
            canAdvance = checklistOk && photoOk;
            advanceLabel = 'Avanzar';
            advanceAction = `moveEquipment(${absIdx}, 1)`;
            extraBtns = `<button class="card-nav-btn warning" onclick="openChecklist(${absIdx})"><i data-lucide="clipboard-check"></i> Checklist</button>`;
            extraBtns += `<button class="card-nav-btn" onclick="openEntryPhotoModal(${absIdx})" style="background:var(--info); color:#fff;"><i data-lucide="camera"></i> 📸 Llegada</button>`;
            extraBtns += `<button class="card-nav-btn" onclick="bypassRepair(${absIdx})" style="background:var(--ochre-yellow); color:#000;">Bypass (Software)</button>`;
            if (repair.checklist && repair.checklist.passed === false) {
                extraBtns += `<button class="card-nav-btn" onclick="moveEquipment(${absIdx}, 1)" style="background:var(--danger); color:#fff;">Enviar a Reparación</button>`;
            }
        }
        else if (repair.station === 'reparacion') {
            canAdvance = repair.solutionId !== null;
            advanceLabel = 'Avanzar';
            advanceAction = `moveEquipment(${absIdx}, 1)`;
            extraBtns = `<button class="card-nav-btn" onclick="openSolutionModal(${absIdx})"><i data-lucide="wrench"></i> Agregar Solución</button>`;
            extraBtns += `<button class="card-nav-btn danger" onclick="markIrreparable(${absIdx})" style="background:var(--danger); color:#fff;">No se pudo reparar</button>`;
        }
        else if (repair.station === 'pruebas') {
            canAdvance = true;
            advanceLabel = 'Avanzar';
            advanceAction = `moveEquipment(${absIdx}, 1)`;
        }
        else if (repair.station === 'limpieza') {
            canAdvance = repair.photos.exit !== null && repair.cleaningTime > 0;
            advanceLabel = 'Entregar';
            advanceAction = `completeEquipment(${absIdx})`;
            extraBtns = `<button class="card-nav-btn" onclick="openExitPhotoModal(${absIdx})" style="background:var(--aquamarine); color:#fff;"><i data-lucide="camera"></i> 📸 Salida / Tiempo</button>`;
        }

        let advanceBtn = '';
        if (canAdvance) {
            advanceBtn = `<button class="card-nav-btn" onclick="${advanceAction}" style="background:var(--aquamarine); color:#fff;">${advanceLabel} <i data-lucide="chevron-right"></i></button>`;
        } else {
            let tooltip = '';
            if (repair.station === 'diagnostico') tooltip = 'Completa checklist y foto de llegada';
            else if (repair.station === 'reparacion') tooltip = 'Agrega una solución';
            else if (repair.station === 'limpieza') tooltip = 'Toma foto de salida y tiempo';
            advanceBtn = `<button class="card-nav-btn" disabled style="opacity:0.5; cursor:not-allowed;" title="${tooltip}">${advanceLabel} <i data-lucide="chevron-right"></i></button>`;
        }

        const prevBtn = hasPrev ? `<button class="card-nav-btn" onclick="moveEquipment(${absIdx}, -1)"><i data-lucide="chevron-left"></i> Atrás</button>` : `<button class="card-nav-btn" disabled>Atrás</button>`;

        const card = document.createElement('div');
        card.className = 'process-card animate-fade-in';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span class="card-eq-model">${repair.model}</span>
                <button class="card-action-trigger" onclick="deleteRepair(${absIdx})"><i data-lucide="x"></i></button>
            </div>
            <span class="card-eq-serial">S/N: ${repair.serial}</span>
            <div class="card-eq-failure">${repair.failureType}</div>
            <div class="card-meta-line"><i data-lucide="user"></i> Técnico: <strong>${techName}</strong></div>
            ${repair.solutionId ? `<div class="card-meta-line"><i data-lucide="check-circle"></i> Solución ID: ${repair.solutionId}</div>` : ''}
            <div class="card-stay-time"><i data-lucide="clock"></i> Estadía: ${stay}</div>
            <div style="font-size:10.5px; background:#f8fafc; padding:5px; border-radius:6px;">${repair.notes || 'Sin notas.'}</div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">${photoBadge}</div>
            <div class="card-nav-controls">${prevBtn} ${extraBtns} ${advanceBtn}</div>
        `;
        lane.appendChild(card);
    });
    createIconsSafe();
}

// MOVIMIENTOS
window.moveEquipment = function(index, delta) {
    const repair = repairOrders[index];
    const currentIdx = STATIONS.indexOf(repair.station);
    const newIdx = currentIdx + delta;
    if (newIdx < 0 || newIdx >= STATIONS.length) return;
    if (currentUser && currentUser.role === 'tecnico' && repair.technicianId !== currentUser.id) {
        showNotification('No puedes mover equipos de otro técnico.');
        return;
    }
    // Validar condiciones específicas antes de mover
    if (repair.station === 'diagnostico' && delta === 1) {
        if (!repair.checklist || repair.checklist.passed !== true) {
            showNotification('Debes aprobar el checklist antes de avanzar.');
            return;
        }
        if (!repair.photos.entry) {
            showNotification('Debes tomar la foto de llegada.');
            return;
        }
    }
    if (repair.station === 'reparacion' && delta === 1) {
        if (!repair.solutionId) {
            showNotification('Debes agregar una solución antes de avanzar.');
            return;
        }
    }
    if (repair.station === 'limpieza' && delta === 1) {
        if (!repair.photos.exit || repair.cleaningTime === 0) {
            showNotification('Completa la limpieza (foto y tiempo) antes de entregar.');
            return;
        }
    }
    repair.station = STATIONS[newIdx];
    if (!repair.timeline[repair.station]) repair.timeline[repair.station] = Date.now();
    saveRepairOrders(); updateRepairsMetrics(); renderRepairsPipeline(); renderTechStock(); renderDailyDelivery();
    showNotification(`Movido a ${repair.station.toUpperCase()}`);
};

window.bypassRepair = function(index) {
    const repair = repairOrders[index];
    if (repair.station === 'diagnostico') {
        repair.station = 'pruebas';
        if (!repair.timeline['pruebas']) repair.timeline['pruebas'] = Date.now();
        saveRepairOrders(); updateRepairsMetrics(); renderRepairsPipeline();
        showNotification(`Bypass: ${repair.serial} a Pruebas (Software)`);
    }
};

window.completeEquipment = function(index) {
    const repair = repairOrders[index];
    if (confirm(`¿Entregar ${repair.serial}?`)) {
        if (!repair.photos.exit) { alert('Debes tomar la foto de salida en la estación de Limpieza antes de entregar.'); return; }
        if (repair.cleaningTime === 0) { alert('Debes registrar el tiempo de limpieza.'); return; }
        repair.timeline.completed = Date.now();
        repair.status = 'completed';
        saveRepairOrders(); updateRepairsMetrics(); renderRepairsPipeline(); renderDailyDelivery();
        showNotification('Equipo entregado (remisión de salida)');
    }
};

window.deleteRepair = function(index) {
    if (confirm(`¿Eliminar ${repairOrders[index].serial}?`)) {
        repairOrders.splice(index, 1);
        saveRepairOrders(); updateRepairsMetrics(); renderRepairsPipeline();
        showNotification('Eliminado');
    }
};

// CHECKLIST
let currentChecklistOrderId = null;
const CHECKLIST_ITEMS = ['Inspección visual externa OK', 'Prueba de encendido OK', 'Pantalla sin daños', 'Puertos funcionales', 'Lector de banda OK', 'Lector de chip OK', 'NFC/Contactless OK', 'Batería retiene carga'];

window.openChecklist = function(index) {
    currentChecklistOrderId = index;
    const container = document.getElementById('checklist-items');
    container.innerHTML = '';
    CHECKLIST_ITEMS.forEach((item, i) => {
        container.innerHTML += `<div class="checkbox-item"><input type="checkbox" id="chk-${i}" /> <label for="chk-${i}">${item}</label></div>`;
    });
    document.getElementById('modal-checklist').style.display = 'flex';
};

window.submitChecklist = function(passed) {
    const repair = repairOrders[currentChecklistOrderId];
    if (!repair) return;
    const results = CHECKLIST_ITEMS.map((_, i) => document.getElementById(`chk-${i}`).checked);
    repair.checklist = { items: CHECKLIST_ITEMS, results, passed, date: new Date().toISOString() };
    if (!passed) {
        repair.notes = (repair.notes || '') + ' | Checklist falló, enviado a Reparación.';
        repair.station = 'reparacion';
        if (!repair.timeline['reparacion']) repair.timeline['reparacion'] = Date.now();
        showNotification('Checklist falló. Equipo a Reparación.');
    } else {
        showNotification('Checklist aprobado. Puedes avanzar.');
    }
    saveRepairOrders();
    closeModal('modal-checklist');
    updateRepairsMetrics();
    renderRepairsPipeline();
};

// SOLUCIONES - con selección de UN repuesto asignado
window.openSolutionModal = function(index) {
    document.getElementById('solution-order-id').value = index;
    const repair = repairOrders[index];
    if (!repair) return;
    const techId = repair.technicianId;
    const myStock = assignedStock.filter(s => s.techId === techId);
    const container = document.getElementById('solution-parts-container');
    if (container) {
        container.innerHTML = '';
        if (myStock.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);">No tienes repuestos asignados en tu banco.</p>';
        } else {
            myStock.forEach((s, idx) => {
                container.innerHTML += `
                    <div class="radio-item">
                        <input type="radio" name="selected-part" id="part-${idx}" value="${s.partId}" data-partname="${s.partName}" data-quantity="${s.quantity}" />
                        <label for="part-${idx}">${s.partName} (${s.quantity} uds.)</label>
                    </div>
                `;
            });
        }
    }
    document.getElementById('modal-solution').style.display = 'flex';
};

window.saveSolution = function() {
    const index = parseInt(document.getElementById('solution-order-id').value);
    const repair = repairOrders[index];
    if (!repair) return;
    const desc = document.getElementById('solution-desc').value.trim();
    if (!desc) { alert('Describe la solución'); return; }
    
    const selectedRadio = document.querySelector('input[name="selected-part"]:checked');
    if (!selectedRadio) {
        alert('Debes seleccionar un repuesto de tu banco.');
        return;
    }
    const partId = parseInt(selectedRadio.value);
    const partName = selectedRadio.dataset.partname;
    
    const stockItem = assignedStock.find(s => s.techId === repair.technicianId && s.partId === partId);
    if (!stockItem || stockItem.quantity < 1) {
        alert('No tienes suficiente stock de este repuesto.');
        return;
    }
    stockItem.quantity--;
    dailyConsumption.push({
        id: Date.now(),
        techId: repair.technicianId,
        partId: partId,
        partName: partName,
        quantity: 1,
        date: new Date().toISOString(),
        orderId: repair.id
    });
    
    const sol = { 
        id: Date.now(), 
        failureType: repair.failureType, 
        model: repair.model, 
        solution: desc, 
        component: partName, 
        createdBy: currentUser ? currentUser.name : 'Sistema', 
        createdAt: new Date().toISOString() 
    };
    solutionDB.push(sol);
    saveSolutionDB();
    repair.solutionId = sol.id;
    repair.notes = (repair.notes || '') + ` | Solución: ${desc} (repuesto: ${partName})`;
    
    saveRepairOrders();
    saveAssignedStock();
    saveDailyConsumption();
    
    closeModal('modal-solution');
    document.getElementById('solution-desc').value = '';
    const radios = document.querySelectorAll('input[name="selected-part"]');
    radios.forEach(r => r.checked = false);
    
    renderRepairsPipeline();
    renderTechStock();
    renderDailyDelivery();
    showNotification('Solución guardada y repuesto descontado.');
};

// IRREPARABLE
window.markIrreparable = function(index) {
    if (confirm('¿Marcar este equipo como irreparable? Pasará a revisión del Coordinador.')) {
        const repair = repairOrders[index];
        repair.status = 'pending_review';
        repair.notes = (repair.notes || '') + ' | Marcado como irreparable. Pendiente revisión Coordinador.';
        saveRepairOrders();
        updateRepairsMetrics();
        renderRepairsPipeline();
        renderCoordinatorView();
        showNotification('Equipo enviado a Revisión de Coordinador.');
    }
};

// COORDINADOR
function renderCoordinatorView() {
    const list = document.getElementById('coordinator-review-list');
    const discarded = document.getElementById('coordinator-discarded-list');
    if (!list) return;
    const pending = repairOrders.filter(r => r.status === 'pending_review');
    const discardedOrders = repairOrders.filter(r => r.status === 'discarded');
    list.innerHTML = pending.length === 0 ? '<p>No hay equipos pendientes de revisión.</p>' : '';
    pending.forEach(r => {
        const div = document.createElement('div');
        div.style.cssText = 'border:1px solid #e2e8f0; padding:15px; border-radius:8px; margin-bottom:10px;';
        div.innerHTML = `
            <strong>${r.model}</strong> - S/N: ${r.serial} - Falla: ${r.failureType}
            <br><small>Técnico: ${getTechName(r.technicianId)}</small>
            <br><em>${r.notes}</em>
            <br>
            <select id="discard-part-${r.id}" class="form-control" style="width:auto; display:inline-block; margin-top:5px;">
                <option value="">Selecciona repuesto para descartar...</option>
                ${inventoryParts.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
            <button class="btn btn-primary" onclick="confirmDiscard(${repairOrders.indexOf(r)})" style="width:auto; padding:5px 15px; margin-top:5px;">✅ Descartar Definitivamente</button>
            <button class="btn btn-secondary" onclick="recoverFromReview(${repairOrders.indexOf(r)})" style="width:auto; padding:5px 15px; margin-top:5px;">↩️ Devolver a Reparación</button>
        `;
        list.appendChild(div);
    });
    discarded.innerHTML = discardedOrders.length === 0 ? '<p>Sin equipos descartados.</p>' : '';
    discardedOrders.forEach(r => {
        const div = document.createElement('div');
        div.style.cssText = 'border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin-bottom:5px; background:#f8fafc;';
        div.innerHTML = `<strong>${r.model}</strong> S/N: ${r.serial} - <span style="color:var(--danger);">DESCARTADO</span> - ${r.notes}`;
        discarded.appendChild(div);
    });
}

window.confirmDiscard = function(index) {
    const repair = repairOrders[index];
    const partId = document.getElementById(`discard-part-${repair.id}`).value;
    if (!partId) { alert('Selecciona un repuesto para justificar el descarte.'); return; }
    const part = inventoryParts.find(p => p.id === parseInt(partId));
    if (part && part.quantity > 0) { part.quantity--; saveInventoryParts(); updateInventoryMetrics(); renderInventoryTable(); }
    else { alert('No hay stock de ese repuesto.'); return; }
    repair.status = 'discarded';
    repair.notes = (repair.notes || '') + ` | Descartado con repuesto: ${part.name}`;
    saveRepairOrders();
    renderCoordinatorView();
    renderRepairsPipeline();
    showNotification('Equipo descartado definitivamente.');
};

window.recoverFromReview = function(index) {
    const repair = repairOrders[index];
    repair.status = 'active';
    repair.station = 'reparacion';
    repair.notes = (repair.notes || '') + ' | Devuelto a reparación por Coordinador.';
    saveRepairOrders();
    renderCoordinatorView();
    renderRepairsPipeline();
    showNotification('Equipo devuelto a Reparación.');
};

// FOTOS DE LLEGADA (DIAGNÓSTICO)
window.openEntryPhotoModal = function(index) {
    currentEntryOrderId = index;
    document.getElementById('entry-photo-order-id').value = index;
    document.getElementById('entry-photo-input').value = '';
    document.getElementById('entry-photo-preview').style.display = 'none';
    document.getElementById('modal-entry-photo').style.display = 'flex';
};
function previewEntryPhoto(input) {
    const preview = document.getElementById('entry-photo-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; preview.style.display = 'block'; };
        reader.readAsDataURL(input.files[0]);
    }
}
window.saveEntryPhoto = function() {
    const index = parseInt(document.getElementById('entry-photo-order-id').value);
    const repair = repairOrders[index];
    if (!repair) return;
    const file = document.getElementById('entry-photo-input').files[0];
    if (!file) { alert('Selecciona una foto.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        repair.photos.entry = e.target.result;
        saveRepairOrders();
        closeModal('modal-entry-photo');
        renderRepairsPipeline();
        showNotification('Foto de llegada guardada.');
    };
    reader.readAsDataURL(file);
};

// FOTOS DE SALIDA Y TIEMPO (LIMPIEZA)
window.openExitPhotoModal = function(index) {
    currentCleaningOrderId = index;
    cleaningSeconds = 0;
    document.getElementById('cleaning-timer').textContent = '00:00';
    document.getElementById('exit-photo-input').value = '';
    document.getElementById('exit-photo-preview').style.display = 'none';
    if (cleaningTimers[index]) clearInterval(cleaningTimers[index]);
    document.getElementById('modal-exit-photo').style.display = 'flex';
};
window.startCleaningTimer = function() {
    if (cleaningTimers[currentCleaningOrderId]) clearInterval(cleaningTimers[currentCleaningOrderId]);
    cleaningTimers[currentCleaningOrderId] = setInterval(() => {
        cleaningSeconds++;
        const m = String(Math.floor(cleaningSeconds / 60)).padStart(2, '0');
        const s = String(cleaningSeconds % 60).padStart(2, '0');
        document.getElementById('cleaning-timer').textContent = `${m}:${s}`;
    }, 1000);
    showNotification('Temporizador iniciado');
};
window.stopCleaningTimer = function() {
    if (cleaningTimers[currentCleaningOrderId]) { clearInterval(cleaningTimers[currentCleaningOrderId]); cleaningTimers[currentCleaningOrderId] = null; showNotification('Temporizador detenido'); }
};
function previewExitPhoto(input) {
    const preview = document.getElementById('exit-photo-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; preview.style.display = 'block'; };
        reader.readAsDataURL(input.files[0]);
    }
}
window.saveExitPhotoAndTime = function() {
    const index = currentCleaningOrderId;
    const repair = repairOrders[index];
    if (!repair) return;
    const file = document.getElementById('exit-photo-input').files[0];
    if (!file) { alert('Selecciona la foto de salida.'); return; }
    if (cleaningSeconds === 0) { alert('Debes medir el tiempo de limpieza.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        repair.photos.exit = e.target.result;
        repair.cleaningTime = cleaningSeconds;
        if (!repair.timeline['limpieza']) repair.timeline['limpieza'] = Date.now();
        saveRepairOrders();
        closeModal('modal-exit-photo');
        if (cleaningTimers[index]) { clearInterval(cleaningTimers[index]); cleaningTimers[index] = null; }
        renderRepairsPipeline();
        renderDailyDelivery();
        showNotification(`Limpieza completada en ${document.getElementById('cleaning-timer').textContent}`);
    };
    reader.readAsDataURL(file);
};

// ASIGNACIÓN DIARIA DE ESTACIÓN
window.assignDailyStation = function() {
    const techId = parseInt(document.getElementById('station-assign-tech').value);
    const station = document.getElementById('station-assign-station').value;
    if (!techId || !station) { alert('Selecciona técnico y estación'); return; }
    stationAssignments[techId] = station;
    saveStationAssignments();
    showNotification(`${getTechName(techId)} asignado a ${station.toUpperCase()} hoy.`);
    renderTechniciansList();
};

// INVENTARIO - FILTRADO POR TÉCNICO
function updateInventoryMetrics() {
    const total = inventoryParts.reduce((a, p) => a + p.quantity, 0);
    const low = inventoryParts.filter(p => p.quantity > 0 && p.quantity <= p.minStock).length;
    const out = inventoryParts.filter(p => p.quantity === 0).length;
    document.getElementById('metric-inv-total').textContent = total;
    document.getElementById('metric-inv-low').textContent = low;
    document.getElementById('metric-inv-out').textContent = out;
    document.getElementById('metric-inv-status').textContent = inventoryParts.length > 0 ? Math.round(((inventoryParts.length - low - out) / inventoryParts.length) * 100) + '%' : '100%';
}

function renderInventoryTable(filter='all', search='') {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    let filtered = inventoryParts;
    if (currentUser && currentUser.role === 'tecnico') {
        const myPartIds = assignedStock.filter(s => s.techId === currentUser.id).map(s => s.partId);
        filtered = filtered.filter(p => myPartIds.includes(p.id));
    }
    if (filter === 'ok') filtered = filtered.filter(p => p.quantity > p.minStock);
    if (filter === 'alert') filtered = filtered.filter(p => p.quantity <= p.minStock);
    if (search.trim()) { const q = search.toLowerCase(); filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.compatibleModels.toLowerCase().includes(q) || p.location.toLowerCase().includes(q)); }
    document.getElementById('no-inv-msg').style.display = filtered.length === 0 ? 'block' : 'none';
    filtered.forEach((p, idx) => {
        const realIdx = inventoryParts.indexOf(p);
        const tr = document.createElement('tr');
        let badge = p.quantity === 0 ? '<span class="badge badge-critical">Agotado</span>' : p.quantity <= p.minStock ? '<span class="badge badge-pending">Stock Bajo</span>' : '<span class="badge badge-completed">OK</span>';
        let displayQty = p.quantity;
        if (currentUser && currentUser.role === 'tecnico') {
            const assigned = assignedStock.find(s => s.techId === currentUser.id && s.partId === p.id);
            displayQty = assigned ? assigned.quantity : 0;
        }
        tr.innerHTML = `<td><div><span class="eq-model">${p.name}</span><span style="font-size:11px;display:block;">${p.location}</span></div></td><td>${p.compatibleModels}</td><td><div class="qty-controller"><span class="qty-val">${displayQty}</span></div></td><td>${badge}</td>`;
        if (!(currentUser && currentUser.role === 'tecnico')) {
            tr.innerHTML += `<td><div class="action-buttons"><button class="action-btn" onclick="editInventory(${realIdx})"><i data-lucide="edit-2"></i></button><button class="action-btn btn-delete" onclick="deleteInventory(${realIdx})"><i data-lucide="trash-2"></i></button></div></td>`;
        } else {
            tr.innerHTML += `<td></td>`;
        }
        tbody.appendChild(tr);
    });
    createIconsSafe();
}

window.adjustPartStock = function(index, delta) {
    if (currentUser && currentUser.role === 'tecnico') {
        showNotification('No puedes modificar el stock global.');
        return;
    }
    const item = inventoryParts[index];
    if (item.quantity + delta < 0) { showNotification('No puede quedar en negativo'); return; }
    item.quantity += delta;
    saveInventoryParts();
    updateInventoryMetrics();
    const filter = document.querySelector('#inventory-filters .tab-btn.active')?.dataset.filter || 'all';
    renderInventoryTable(filter, document.getElementById('inventory-search').value);
    populateAssignDropdowns();
};
function editInventory(index) {
    if (currentUser && currentUser.role === 'tecnico') { showNotification('No tienes permiso.'); return; }
    const p = inventoryParts[index];
    document.getElementById('inv-edit-index').value = index;
    document.getElementById('part-name').value = p.name;
    document.getElementById('part-model').value = p.compatibleModels;
    document.getElementById('part-qty').value = p.quantity;
    document.getElementById('part-min').value = p.minStock;
    document.getElementById('part-location').value = p.location;
    document.getElementById('inv-submit-btn').innerHTML = '<i data-lucide="refresh-cw"></i> Actualizar';
    document.getElementById('inv-cancel-btn').style.display = 'block';
}
function deleteInventory(index) {
    if (currentUser && currentUser.role === 'tecnico') { showNotification('No tienes permiso.'); return; }
    if (confirm(`Eliminar ${inventoryParts[index].name}?`)) { inventoryParts.splice(index, 1); saveInventoryParts(); updateInventoryMetrics(); renderInventoryTable(); populateAssignDropdowns(); showNotification('Eliminado'); }
}

// STAFF
function updateStaffMetrics() {
    document.getElementById('metric-tech-count').textContent = technicians.length;
    document.getElementById('metric-tools-count').textContent = tools.length;
    document.getElementById('metric-tools-unassigned').textContent = tools.filter(t => !t.assignedTo).length;
}
function renderTechniciansList() {
    const container = document.getElementById('tech-cards-container');
    if (!container) return;
    container.innerHTML = '';
    technicians.forEach(tech => {
        const techTools = tools.filter(t => t.assignedTo === tech.id).map(t => t.name);
        const assigned = stationAssignments[tech.id] || 'No asignado';
        const card = document.createElement('div');
        card.className = 'tech-profile-card';
        card.innerHTML = `
            <div class="tech-profile-header"><span class="tech-profile-name">${tech.name}</span><span class="tech-profile-role">${tech.specialty}</span></div>
            <div class="tech-profile-body">
                <div>📌 <strong>Estación hoy:</strong> ${assigned.toUpperCase()}</div>
                <div>🛠️ <strong>Herramientas:</strong> ${techTools.length > 0 ? techTools.join(', ') : 'Ninguna'}</div>
                <button class="tech-link-btn" onclick="copyTechLink(${tech.id}, '${tech.name}')"><i data-lucide="link"></i> Copiar Enlace</button>
                ${(currentUser && (currentUser.role === 'administrador' || currentUser.role === 'coordinador')) ? `<button class="tech-link-btn" onclick="editTechnician(${tech.id})" style="background:rgba(255,198,0,0.1); color:var(--ochre-dark);"><i data-lucide="pencil"></i> Editar</button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
    createIconsSafe();
}
function editTechnician(id) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    document.getElementById('tech-edit-id').value = user.id;
    document.getElementById('tech-name').value = user.name;
    document.getElementById('tech-specialty').value = user.specialty;
    document.querySelectorAll('#tech-form .permissions-grid input').forEach(chk => chk.checked = true);
    document.getElementById('tech-submit-btn').innerHTML = '<i data-lucide="refresh-cw"></i> Actualizar';
    document.getElementById('tech-cancel-btn').style.display = 'block';
}
window.copyTechLink = function(id, name) { const url = `${window.location.origin}${window.location.pathname}?tech=${id}`; navigator.clipboard.writeText(url).then(() => showNotification(`Enlace copiado para ${name}`)); };
function renderToolsTable() {
    const tbody = document.getElementById('tools-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (tools.length === 0) { document.getElementById('no-tools-msg').style.display = 'block'; return; }
    document.getElementById('no-tools-msg').style.display = 'none';
    tools.forEach((t, idx) => {
        const tech = technicians.find(te => te.id === t.assignedTo);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><div><span>${t.name}</span><span style="display:block;font-size:11px;">${t.code}</span></div></td><td>${tech ? tech.name : 'Sin asignar'}</td><td><span class="badge badge-completed">Custodia</span></td><td><button class="action-btn btn-delete" onclick="deleteTool(${idx})"><i data-lucide="trash-2"></i></button></td>`;
        tbody.appendChild(tr);
    });
}
window.deleteTool = function(index) { if (confirm(`Retirar ${tools[index].name}?`)) { tools.splice(index, 1); saveTools(); updateStaffMetrics(); renderToolsTable(); renderTechniciansList(); showNotification('Retirada'); } };

// ASIGNAR STOCK
function assignStockToTech() {
    if (!hasPermission('inventory', 'assign')) { showNotification('No tienes permiso.'); return; }
    const techId = parseInt(document.getElementById('assign-tech').value);
    const partId = parseInt(document.getElementById('assign-part').value);
    const qty = parseInt(document.getElementById('assign-qty').value) || 1;
    if (!techId || !partId) { alert('Selecciona todo'); return; }
    const part = inventoryParts.find(p => p.id === partId);
    if (!part || part.quantity < qty) { alert('Stock insuficiente'); return; }
    part.quantity -= qty;
    saveInventoryParts();
    const existing = assignedStock.find(s => s.techId === techId && s.partId === partId);
    if (existing) existing.quantity += qty;
    else assignedStock.push({ id: Date.now(), techId, partId, partName: part.name, quantity: qty });
    saveAssignedStock();
    updateInventoryMetrics(); renderInventoryTable(); populateAssignDropdowns(); renderTechStock();
    showNotification(`Asignados ${qty} ${part.name} a ${getTechName(techId)}`);
}
function renderTechStock() {
    const container = document.getElementById('tech-stock-list');
    if (!container || !currentUser || currentUser.role !== 'tecnico') { if(container) container.innerHTML = ''; return; }
    const myStock = assignedStock.filter(s => s.techId === currentUser.id);
    container.innerHTML = myStock.length === 0 ? '<p style="color:var(--text-secondary);">Sin repuestos asignados.</p>' : `<ul style="list-style:none;padding:0;">${myStock.map(s => `<li style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e2e8f0;"><span>${s.partName}</span><span style="font-weight:700;color:var(--aquamarine);">${s.quantity} uds.</span></li>`).join('')}</ul>`;
}

// TV
function renderTvDashboard() {
    const container = document.getElementById('tv-team-progress-container');
    const alerts = document.getElementById('tv-critical-stock-alerts');
    const ticker = document.getElementById('tv-ticker-msg');
    if (!container) return;
    container.innerHTML = ''; alerts.innerHTML = '';
    technicians.forEach(tech => {
        const active = repairOrders.filter(r => r.technicianId === tech.id && r.status === 'active' && r.station !== 'limpieza').length;
        const finished = repairOrders.filter(r => r.technicianId === tech.id && r.status === 'active' && r.station === 'limpieza').length;
        const total = active + finished;
        const percent = total > 0 ? Math.round((finished / total) * 100) : 0;
        const card = document.createElement('div');
        card.className = 'team-progress-card';
        card.innerHTML = `
            <div class="team-progress-header"><span class="team-tech-name">${tech.name}</span><span class="team-tech-specialty">${tech.specialty}</span></div>
            <div class="progress-bar-container"><div class="progress-bar-labels"><span>Avance</span><span>${percent}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${percent}%;"></div></div></div>
            <div class="team-stats-row"><span>📋 Activos: ${active}</span><span>🧪 QA: ${finished}</span></div>
        `;
        container.appendChild(card);
    });
    const totalActive = repairOrders.filter(r => r.status === 'active').length;
    document.getElementById('tv-total-active').textContent = totalActive;
    const completed = repairOrders.filter(r => r.status === 'completed');
    let avgTat = "1d 4h";
    if (completed.length > 0) { const avg = completed.reduce((s, r) => s + (r.timeline.completed - r.timeline.diagnostico), 0) / completed.length; avgTat = formatTimeElapsed(avg); }
    document.getElementById('tv-tat-val').textContent = avgTat;
    const eff = totalActive > 0 ? Math.round((repairOrders.filter(r => r.status === 'active' && r.station === 'limpieza').length / totalActive) * 100) : 100;
    document.getElementById('tv-efficiency-val').textContent = `${eff}%`;
    const critical = inventoryParts.filter(p => p.quantity === 0);
    alerts.innerHTML = critical.length === 0 ? '<div style="color:var(--aquamarine);padding:10px;text-align:center;">✅ Almacén abastecido.</div>' : critical.map(p => `<div style="background:rgba(239,68,68,0.05);color:var(--danger);padding:8px;border-radius:6px;border-left:4px solid var(--danger);font-weight:600;">🚨 AGOTADO: "${p.name}"</div>`).join('');
    const last = completed[completed.length - 1];
    ticker.innerHTML = last ? `🎉 Último despachado: <strong>${last.model} (${last.serial})</strong> por ${getTechName(last.technicianId)}` : '📈 CCO Service Hub operando con normalidad.';
}
function renderDailyDelivery() {
    const container = document.getElementById('daily-delivery-panel');
    if (!container) return;
    const today = new Date().toDateString();
    const todayConsumption = dailyConsumption.filter(c => new Date(c.date).toDateString() === today);
    if (todayConsumption.length === 0) { container.innerHTML = '<p style="color:var(--text-secondary);">Sin consumo hoy.</p>'; return; }
    const grouped = {};
    todayConsumption.forEach(c => { if (!grouped[c.techId]) grouped[c.techId] = []; grouped[c.techId].push(c); });
    let html = '';
    for (const [techId, items] of Object.entries(grouped)) {
        const techName = getTechName(parseInt(techId));
        const summary = {};
        items.forEach(c => { if (!summary[c.partName]) summary[c.partName] = 0; summary[c.partName] += c.quantity; });
        html += `<div style="margin-bottom:10px;padding:8px;background:#f8fafc;border-radius:8px;"><strong>${techName}</strong><ul style="list-style:none;padding:0;">`;
        for (const [part, qty] of Object.entries(summary)) html += `<li style="display:flex;justify-content:space-between;font-size:12px;">${part} <span style="font-weight:600;">${qty} uds.</span></li>`;
        html += `</ul></div>`;
    }
    container.innerHTML = html;
}
function checkBottlenecks() {
    const counts = { diagnostico: 0, reparacion: 0, pruebas: 0, limpieza: 0 };
    repairOrders.filter(r => r.status === 'active').forEach(r => { if (counts[r.station] !== undefined) counts[r.station]++; });
    const alertDiv = document.getElementById('bottleneck-alert');
    let msg = '';
    for (const [s, c] of Object.entries(counts)) if (c > 2) msg += `🚨 CUELLO DE BOTELLA en ${s.toUpperCase()} (${c}) `;
    if (msg) { alertDiv.style.display = 'block'; alertDiv.textContent = msg + ' - Considera mover personal.'; } else alertDiv.style.display = 'none';
}
function update5SStatus() {
    const checks = ['chk-5s-seiri','chk-5s-seiton','chk-5s-seiso','chk-5s-seiketsu','chk-5s-shitsuke'];
    const all = checks.every(id => document.getElementById(id).checked);
    const status = document.getElementById('tv-5s-status');
    if (all) { status.style.background = 'rgba(0,175,170,0.08)'; status.style.color = 'var(--aquamarine)'; status.innerHTML = '✅ Auditoría Completada'; }
    else { status.style.background = 'rgba(239,68,68,0.08)'; status.style.color = 'var(--danger)'; status.innerHTML = '❌ Pendiente'; }
}

// ANALYTICS
function applyFilters() {
    const from = document.getElementById('filter-date-from').value;
    const to = document.getElementById('filter-date-to').value;
    const model = document.getElementById('filter-model').value;
    const failure = document.getElementById('filter-failure').value;
    const techId = document.getElementById('filter-tech').value;
    let filtered = repairOrders;
    if (from) filtered = filtered.filter(r => new Date(r.timeline.diagnostico) >= new Date(from));
    if (to) { const d = new Date(to); d.setHours(23,59,59); filtered = filtered.filter(r => new Date(r.timeline.diagnostico) <= d); }
    if (model) filtered = filtered.filter(r => r.model === model);
    if (failure) filtered = filtered.filter(r => r.failureType.includes(failure));
    if (techId) filtered = filtered.filter(r => r.technicianId === parseInt(techId));
    document.getElementById('analytics-total').textContent = filtered.length;
    const completed = filtered.filter(r => r.status === 'completed');
    if (completed.length > 0) { const avg = completed.reduce((s, r) => s + (r.timeline.completed - r.timeline.diagnostico), 0) / completed.length; document.getElementById('analytics-tat').textContent = formatTimeElapsed(avg); document.getElementById('analytics-success').textContent = Math.round((completed.length/filtered.length)*100)+'%'; }
    else { document.getElementById('analytics-tat').textContent = '-'; document.getElementById('analytics-success').textContent = '-'; }
    const sols = filtered.filter(r => r.solutionId).map(r => solutionDB.find(s => s.id === r.solutionId)).filter(Boolean);
    const solCount = {};
    sols.forEach(s => { if (!solCount[s.solution]) solCount[s.solution] = 0; solCount[s.solution]++; });
    const topSols = Object.entries(solCount).sort((a,b) => b[1]-a[1]).slice(0,5);
    document.getElementById('analytics-solutions').innerHTML = topSols.length ? topSols.map(([sol, count]) => `<div>${sol} (${count} veces)</div>`).join('') : 'Sin soluciones registradas';
}
function exportFilteredData() {
    const from = document.getElementById('filter-date-from').value;
    const to = document.getElementById('filter-date-to').value;
    const model = document.getElementById('filter-model').value;
    const failure = document.getElementById('filter-failure').value;
    const techId = document.getElementById('filter-tech').value;
    let filtered = repairOrders;
    if (from) filtered = filtered.filter(r => new Date(r.timeline.diagnostico) >= new Date(from));
    if (to) { const d = new Date(to); d.setHours(23,59,59); filtered = filtered.filter(r => new Date(r.timeline.diagnostico) <= d); }
    if (model) filtered = filtered.filter(r => r.model === model);
    if (failure) filtered = filtered.filter(r => r.failureType.includes(failure));
    if (techId) filtered = filtered.filter(r => r.technicianId === parseInt(techId));
    if (filtered.length === 0) { alert('Sin datos para exportar'); return; }
    let csv = "data:text/csv;charset=utf-8,\uFEFFAUFNR,EQUNR,BAUTL,FEHLER,MATNR,MENGE,ARBPL,AUEDD\r\n";
    filtered.forEach(r => {
        const tech = technicians.find(t => t.id === r.technicianId);
        const part = inventoryParts.find(p => r.failureType.includes('Batería') ? p.name.includes('Batería') : p.name.includes('Puerto'));
        csv += `${r.sapPmOrderId || 'N/A'},"${r.serial}","${r.model}","${r.failureType}","${part ? part.id : 'N/A'}",1,"${tech ? tech.name : 'N/A'}","${r.timeline.completed ? new Date(r.timeline.completed).toISOString().split('T')[0] : ''}"\r\n`;
    });
    const link = document.createElement('a'); link.href = encodeURI(csv); link.download = 'export_sap_ccohub.csv'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showNotification('Exportación SAP generada.');
}
window.exportToCSV = function() {
    if (repairOrders.length === 0) { alert('No hay datos'); return; }
    let csv = "data:text/csv;charset=utf-8,\uFEFFID,Modelo,Serial,Falla,Técnico,Estación,Estado,SAP,Soft,TAT\r\n";
    repairOrders.forEach(r => {
        const tech = technicians.find(t => t.id === r.technicianId);
        const tat = r.timeline.completed ? formatTimeElapsed(r.timeline.completed - r.timeline.diagnostico) : 'En curso';
        csv += `${r.id},"${r.model}","${r.serial}","${r.failureType}","${tech ? tech.name : 'N/A'}","${r.station}","${r.status}","${r.sapPmOrderId}","${r.softwareOperation}","${tat}"\r\n`;
    });
    const link = document.createElement('a'); link.href = encodeURI(csv); link.download = 'reporte_ccohub.csv'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showNotification('Reporte exportado.');
};

// DIAGNÓSTICOS
const DIAGNOSTIC_DATABASE = [
    { id: "puerto", title: "Puerto de carga dañado", brand: "General", desc: "No recibe corriente.", steps: ["Inspeccionar", "Medir voltaje", "Revisar PMIC"], tip: "Refuerza soldadura." },
    { id: "bateria", title: "Batería no retiene carga", brand: "General", desc: "Se descarga rápido.", steps: ["Inspeccionar inflado", "Medir consumo", "Reemplazar"], tip: "No pinches la batería." },
    { id: "lector", title: "Lector de chip falla", brand: "General", desc: "No lee tarjetas.", steps: ["Limpiar", "Revisar FPC", "Reemplazar"], tip: "Revisa flex." },
    { id: "tamper", title: "Alerta de Seguridad", brand: "General", desc: "Tamper activado.", steps: ["Revisar switches", "Medir RTC", "Restablecer"], tip: "Cuidado resortes." },
    { id: "software", title: "Loop de reinicio", brand: "Android", desc: "Se reinicia.", steps: ["Recovery", "Wipe Cache", "Flashear"], tip: "Usa firmware oficial." }
];
function renderDiagnostics(search='') {
    const container = document.getElementById('diagnostic-results');
    if (!container) return;
    container.innerHTML = '';
    let filtered = DIAGNOSTIC_DATABASE;
    if (search.trim()) { const q = search.toLowerCase(); filtered = filtered.filter(d => d.title.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q)); }
    if (filtered.length === 0) { container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);">No encontrado.</div>'; return; }
    filtered.forEach(d => {
        const div = document.createElement('div');
        div.style.cssText = 'background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:15px;margin-bottom:15px;';
        div.innerHTML = `<h3 style="font-size:14px;font-weight:700;">${d.title}</h3><p style="font-size:12px;color:var(--text-secondary);">${d.desc}</p><ol style="font-size:12px;margin-left:15px;">${d.steps.map((s,i) => `<li><strong>Paso ${i+1}:</strong> ${s}</li>`).join('')}</ol><div style="background:rgba(255,198,0,0.06);padding:8px;border-radius:6px;font-size:11px;"><strong>Consejo:</strong> ${d.tip}</div>`;
        container.appendChild(div);
    });
}

window.clearTechFilter = function() {
    activeTechIdFilter = null;
    history.replaceState({}, '', window.location.pathname);
    document.getElementById('tech-filter-banner').style.display = 'none';
    document.getElementById('header-app-title').textContent = "CCO Service Hub";
    document.getElementById('header-app-subtitle').textContent = "NEXGO COLOMBIA & CHINA";
    const sel = document.getElementById('eq-tech-assign'); if (sel) { sel.disabled = false; sel.value = ""; }
    updateRepairsMetrics(); renderRepairsPipeline(); showNotification("Vista completa.");
};
