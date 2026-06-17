/*
   CrediLab - Lógica de Negocio y Mantenimiento V5 (Edición Corporativa con Auto-Migración)
   Estructuras de Datos Alineadas a Contrato:
   - repairOrders (Equipos)
   - inventoryParts (Repuestos)
   - technicians (Técnicos)
   - tools (Herramientas)
   Características: Tablero Lineal, KPI de TAT Promedio en Tiempo Real, Marcas de Estación, Exportación a Excel CSV.
*/

// --- CARGA SEGURA DE ICONOS ---
function createIconsSafe() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    } else {
        console.warn("Lucide library is unavailable (offline mode).");
    }
}

// --- ESTRUCTURA LINEAL DE ESTACIONES ---
const STATIONS = ['diagnostico', 'apertura', 'pruebas', 'limpieza'];

// --- BASE DE DATOS DE DIAGNÓSTICOS ELECTRÓNICOS REALES ---
const DIAGNOSTIC_DATABASE = [
    {
        id: "puerto-carga",
        title: "Puerto de carga dañado / No enciende",
        brand: "Ingenico Axium & Clásicos",
        desc: "El equipo no recibe corriente o el LED de carga no se ilumina.",
        steps: [
            "Inspecciona el puerto USB-C o Jack de carga bajo el microscopio para verificar pines doblados o rotos.",
            "Mide el voltaje en los pines de entrada del circuito de carga en la placa principal (debe marcar ~5V).",
            "Desconecta la batería y mide su voltaje directo: si está por debajo de 3.2V, realiza una carga de reactivación controlada con la fuente de poder regulada.",
            "Verifica el circuito integrado de carga (PMIC) buscando componentes sobrecalentados con cámara térmica o alcohol isopropílico."
        ],
        tip: "En los modelos Ingenico Axium DX8000, los puertos USB-C sufren fatiga mecánica. Refuerza los puntos de anclaje con soldadura de alta resistencia."
    },
    {
        id: "bateria",
        title: "Batería no retiene carga / Inflada",
        brand: "General / Android POS",
        desc: "La batería se descarga rápido, causa reinicios aleatorios o está físicamente deformada.",
        steps: [
            "Inspecciona visualmente la batería: si muestra signos de inflamiento (hinchazón), retírala inmediatamente y deposítala en contenedor seguro.",
            "Conecta el datáfono a la fuente de corriente y mide el consumo de amperaje. Un consumo fluctuante o nulo indica falla en el circuito de control de la batería.",
            "Reemplaza la celda por una original homologada por Credibanco.",
            "Realiza una prueba de ciclo completo: carga al 100% y descarga controlada para calibrar el chip de medición de carga (Fuel Gauge)."
        ],
        tip: "Las baterías de litio hinchadas son un riesgo de seguridad de alto nivel. Nunca intentes pincharlas ni soldar directo sobre las celdas."
    },
    {
        id: "lector-chip",
        title: "Lector de chip no lee tarjetas",
        brand: "Ingenico Axium & Pax",
        desc: "Error 'Tarjeta no leída' o no detecta la inserción del plástico.",
        steps: [
            "Usa una tarjeta de limpieza humedecida con alcohol isopropílico para limpiar los contactos dorados del lector interno.",
            "Si persiste, desarma el equipo y revisa bajo microscopio el switch mecánico de detección al fondo de la ranura. Si está doblado, enderézalo con pinzas de precisión.",
            "Verifica la continuidad del cable plano (flex) que conecta el lector de chip con el procesador seguro.",
            "Si los pines internos están desgastados o rotos, desuelda el módulo lector completo y reemplázalo por uno nuevo."
        ],
        tip: "En los Ingenico Axium EX8000, el lector es un sub-módulo. Revisa que el conector de presión tipo FPC esté perfectamente asegurado."
    },
    {
        id: "tamper",
        title: "Alerta de Seguridad (Tamper Alert / Bloqueado)",
        brand: "Seguridad PCI / Todos",
        desc: "Pantalla muestra 'Hardware Tamper', 'Alert Irruption' o bloqueo de seguridad.",
        steps: [
            "Esta alerta se dispara mecánicamente cuando se abren las carcasas y se activan los micro-switches de intrusión alimentados por la batería de respaldo (RTC).",
            "Inspecciona mecánicamente los resortes de los switches de seguridad en la placa. Asegúrate de que encajen perfectamente al cerrar la carcasa.",
            "Mide el voltaje de la batería interna del reloj de tiempo real (pila de respaldo de 3V). Si está por debajo de 2.6V, reemplázala.",
            "**Solución de Software**: Para retirar el bloqueo de seguridad PCI, se requiere conectar el datáfono al software de fábrica (ej. Ingenico Axium Secure Tool) con la firma digital autorizada por Credibanco para restablecer las llaves criptográficas."
        ],
        tip: "¡Fuerza de trabajo! Nunca desarmes un datáfono encendido o sin haber verificado que los resortes internos de tamper estén en su posición. Perderá las llaves de encriptación."
    },
    {
        id: "software-loop",
        title: "Error de software / Loop de reinicio (Android)",
        brand: "Android POS (Axium/T650p/A920)",
        desc: "El datáfono se queda pegado en el logo de inicio o se reinicia constantemente.",
        steps: [
            "Apaga el dispositivo por completo. Mantén presionado el botón de Encendido + Subir Volumen (o Bajar Volumen según el modelo) para ingresar al menú de Recovery.",
            "Realiza un 'Wipe Cache Partition' y luego un 'Wipe Data/Factory Reset' si está permitido por las políticas de Credibanco.",
            "Si continúa en loop, conecta el datáfono por USB a la PC del laboratorio para flashear el firmware oficial firmado usando la herramienta autorizada.",
            "Revisa si hay componentes de hardware en corto (como el chip Wi-Fi o NFC) que estén provocando que el kernel de Android falle al iniciar."
        ],
        tip: "Los datáfonos Axium DX8000 corren sobre Android seguro. Asegúrate de tener la última versión del sistema operativo proporcionada por Credibanco para evitar bugs de bucle."
    }
];

// --- MOCK DATA POR DEFECTO ---

const DEFAULT_TECHNICIANS = [
    { id: 105, name: "Andrés Arenas Díaz", specialty: "Coordinador de Taller", permissions: ["diagnostico", "apertura", "pruebas", "limpieza"] },
    { id: 101, name: "Carlos Mendoza", specialty: "Hardware", permissions: ["diagnostico", "apertura", "pruebas"] },
    { id: 102, name: "María Rodríguez", specialty: "Software", permissions: ["diagnostico", "pruebas", "limpieza"] },
    { id: 103, name: "Felipe Soto", specialty: "QA / Calidad", permissions: ["diagnostico", "pruebas"] },
    { id: 106, name: "Diana Torres", specialty: "Generalist Técnico", permissions: ["diagnostico", "apertura", "pruebas", "limpieza"] },
    { id: 107, name: "Jorge Delgado", specialty: "Almacenista", permissions: [] } // Jorge Delgado es el Almacenista (sin estaciones asignadas)
];

const DEFAULT_TOOLS = [
    { id: 201, name: "Estación de Calor Weller WTHA 1", code: "HER-00102", assignedTo: 101 },
    { id: 202, name: "Multímetro Industrial Fluke 87V", code: "HER-00210", assignedTo: 101 },
    { id: 203, name: "Microscopio Trinoculador Kaisi 7050", code: "HER-00305", assignedTo: 105 },
    { id: 204, name: "Programador JTAG J-Link Pro", code: "HER-00442", assignedTo: 102 }
];

const DEFAULT_INVENTORY_PARTS = [
    { id: 301, name: "Batería Li-Po N6/N86 (5200mAh)", compatibleModels: "Nexgo N6 / Nexgo N86", quantity: 15, minStock: 5, location: "Estante A-1, Cajón 1" },
    { id: 302, name: "Puerto de carga USB-C Hembra (Nexgo)", compatibleModels: "Nexgo N6 / Nexgo N86", quantity: 40, minStock: 10, location: "Cajón B-2" },
    { id: 303, name: "Cable Flex de Pantalla LCD (N6)", compatibleModels: "Nexgo N6", quantity: 8, minStock: 3, location: "Estante A-3, Gaveta 2" },
    { id: 304, name: "Módulo Lector de Chip (N86)", compatibleModels: "Nexgo N86", quantity: 6, minStock: 2, location: "Cajón C-1" },
    { id: 305, name: "Antena GPRS/WiFi (KD69)", compatibleModels: "Nexgo KD69", quantity: 12, minStock: 4, location: "Cajón B-4" }
];

const timeBase = Date.now();

const DEFAULT_REPAIR_ORDERS = [
    {
        id: 401,
        model: "Nexgo N6",
        serial: "NX6-8829103",
        failureType: "Puerto de carga dañado / No enciende",
        technicianId: 101,
        station: "apertura",
        notes: "Desarme cuidadoso de carcasa inferior (8 tornillos M1.6). Revisar flex de pantalla.",
        status: "active",
        sapPmOrderId: "PM-2026-1001",
        softwareOperation: "Ninguna (Hardware)",
        timeline: {
            diagnostico: timeBase - (3 * 24 * 60 * 60 * 1000),
            apertura: timeBase - (4 * 60 * 60 * 1000),
            pruebas: null,
            limpieza: null,
            completed: null
        }
    },
    {
        id: 402,
        model: "Nexgo KD69",
        serial: "NXKD-5592813",
        failureType: "Falla de Comunicación (GPRS/Wi-Fi)",
        technicianId: 102,
        station: "diagnostico",
        notes: "No conecta a red GPRS. Revisar simcard y realizar test de transacciones.",
        status: "active",
        sapPmOrderId: "PM-2026-1002",
        softwareOperation: "Re-inyección de parámetros GPRS/Wi-Fi",
        timeline: {
            diagnostico: timeBase - (1 * 60 * 60 * 1000),
            apertura: null,
            pruebas: null,
            limpieza: null,
            completed: null
        }
    },
    {
        id: 403,
        model: "Nexgo N86",
        serial: "NX86-9920192",
        failureType: "Batería no retiene carga / Inflada",
        technicianId: 106,
        station: "apertura",
        notes: "Cambio de celda inflada. Torque de tornillos a 0.4 Nm en ensamble.",
        status: "active",
        sapPmOrderId: "PM-2026-1003",
        softwareOperation: "Calibración de batería (Fuel Gauge)",
        timeline: {
            diagnostico: timeBase - (1 * 24 * 60 * 60 * 1000),
            apertura: timeBase - (6 * 60 * 60 * 1000),
            pruebas: null,
            limpieza: null,
            completed: null
        }
    },
    {
        id: 404,
        model: "Nexgo UN20",
        serial: "NXUN-2291039",
        failureType: "Lector de chip no lee tarjetas",
        technicianId: 103,
        station: "pruebas",
        notes: "Mantenimiento preventivo por polvo en ranura. Test transaccional completado.",
        status: "active",
        sapPmOrderId: "PM-2026-1004",
        softwareOperation: "Carga de llaves Credibanco",
        timeline: {
            diagnostico: timeBase - (2 * 24 * 60 * 60 * 1000),
            apertura: timeBase - (1 * 24 * 60 * 60 * 1000),
            pruebas: timeBase - (30 * 60 * 1000),
            limpieza: null,
            completed: null
        }
    },
    {
        id: 405,
        model: "Nexgo N6",
        serial: "NX6-9910391",
        failureType: "Puerto de carga dañado / No enciende",
        technicianId: 101,
        station: "limpieza",
        notes: "Soldadura exitosa de USB-C. Limpieza externa y alistamiento final.",
        status: "completed",
        sapPmOrderId: "PM-2026-1005",
        softwareOperation: "Firmware Oficial v2.1.0 Flasheado",
        timeline: {
            diagnostico: timeBase - (5 * 24 * 60 * 60 * 1000),
            apertura: timeBase - (4 * 24 * 60 * 60 * 1000),
            pruebas: timeBase - (3 * 24 * 60 * 60 * 1000),
            limpieza: timeBase - (1 * 24 * 60 * 60 * 1000),
            completed: timeBase - (1 * 24 * 60 * 60 * 1000)
        }
    }
];

// --- COLECCIONES GLOBALES ---
let repairOrders = [];
let inventoryParts = [];
let technicians = [];
let tools = [];

// --- FILTRO DE ENLACE DE TÉCNICO POR ID (?tech=id) ---
let activeTechIdFilter = null;

// --- INICIALIZAR Y CARGAR DATOS ---
function initData() {
    // 1. CARGA DE TÉCNICOS
    const storedTechs = localStorage.getItem('credilab_technicians');
    if (storedTechs) {
        technicians = JSON.parse(storedTechs);
    } else {
        technicians = [...DEFAULT_TECHNICIANS];
        localStorage.setItem('credilab_technicians', JSON.stringify(technicians));
    }

    // 2. CARGA DE HERRAMIENTAS Y AUTO-MIGRACIÓN
    const storedTools = localStorage.getItem('credilab_tools');
    if (storedTools) {
        tools = JSON.parse(storedTools);
        // Migración: mapear tech a assignedTo si es necesario
        tools = tools.map(t => {
            if (t.tech !== undefined && !t.assignedTo) {
                const match = technicians.find(tech => tech.name === t.tech);
                t.assignedTo = match ? match.id : 104;
                delete t.tech;
            }
            return t;
        });
        saveTools();
    } else {
        tools = [...DEFAULT_TOOLS];
        localStorage.setItem('credilab_tools', JSON.stringify(tools));
    }

    // 3. CARGA DE REPUESTOS Y AUTO-MIGRACIÓN
    const storedInventory = localStorage.getItem('credilab_inventoryParts');
    if (storedInventory) {
        inventoryParts = JSON.parse(storedInventory);
        // Migración: mapear qty -> quantity, min -> minStock, model -> compatibleModels
        inventoryParts = inventoryParts.map(p => {
            if (p.qty !== undefined) { p.quantity = p.qty; delete p.qty; }
            if (p.min !== undefined) { p.minStock = p.min; delete p.min; }
            if (p.model !== undefined) { p.compatibleModels = p.model; delete p.model; }
            if (!p.id) p.id = Date.now() + Math.random();
            return p;
        });
        saveInventoryParts();
    } else {
        inventoryParts = [...DEFAULT_INVENTORY_PARTS];
        localStorage.setItem('credilab_inventoryParts', JSON.stringify(inventoryParts));
    }

    // 4. CARGA DE REPARACIONES Y AUTO-MIGRACIÓN
    const storedRepairs = localStorage.getItem('credilab_repairOrders');
    if (storedRepairs) {
        repairOrders = JSON.parse(storedRepairs);
        // MIGRACIÓN CRÍTICA DE DATOS ANTIGUOS DE LOCALSTORAGE
        repairOrders = repairOrders.map(r => {
            // Mapear status viejo (ej. recibo, diagnostico) a station
            if (!r.station) {
                if (r.status && STATIONS.includes(r.status)) {
                    r.station = r.status;
                } else {
                    r.station = "recibo";
                }
            }
            // Estandarizar status general a active / completed
            if (r.status !== 'active' && r.status !== 'completed') {
                r.status = 'active';
            }
            // Agregar timeline si no lo posee
            if (!r.timeline) {
                r.timeline = {
                    recibo: Date.now() - (60 * 60 * 1000),
                    diagnostico: null,
                    reparacion: null,
                    software: null,
                    test: null,
                    completed: null
                };
                r.timeline[r.station] = Date.now() - (10 * 60 * 1000);
            }
            // Vincular técnico por ID si tiene techAssign plano anterior
            if (!r.technicianId && r.techAssign) {
                const match = technicians.find(t => t.name === r.techAssign);
                r.technicianId = match ? match.id : 104;
                delete r.techAssign;
            }
            if (!r.technicianId) {
                r.technicianId = 104; // Asignar default Generalist
            }
            return r;
        });
        saveRepairOrders();
    } else {
        repairOrders = [...DEFAULT_REPAIR_ORDERS];
        localStorage.setItem('credilab_repairOrders', JSON.stringify(repairOrders));
    }

    // COMPROBAR PARÁMETRO DE URL (?tech=ID_TECNICO)
    const urlParams = new URLSearchParams(window.location.search);
    const techParam = urlParams.get('tech');
    if (techParam) {
        const techMatch = technicians.find(t => t.id.toString() === techParam || t.name.toLowerCase() === techParam.toLowerCase());
        if (techMatch) {
            activeTechIdFilter = techMatch.id;
            setupTechFilterUI(techMatch.name);
        }
    }
}

function saveRepairOrders() { localStorage.setItem('credilab_repairOrders', JSON.stringify(repairOrders)); }
function saveInventoryParts() { localStorage.setItem('credilab_inventoryParts', JSON.stringify(inventoryParts)); }
function saveTechnicians() { localStorage.setItem('credilab_technicians', JSON.stringify(technicians)); }
function saveTools() { localStorage.setItem('credilab_tools', JSON.stringify(tools)); }

// --- CONFIGURAR UI DE FILTRO DE TÉCNICO ---
function setupTechFilterUI(techName) {
    const banner = document.getElementById('tech-filter-banner');
    const filterNameEl = document.getElementById('tech-filter-name');
    const headerTitle = document.getElementById('header-app-title');
    const headerSubtitle = document.getElementById('header-app-subtitle');
    
    if (banner && filterNameEl) {
        banner.style.display = 'flex';
        filterNameEl.textContent = techName;
    }
    
    if (headerTitle && headerSubtitle) {
        headerTitle.textContent = `CrediLab`;
        headerSubtitle.textContent = `VISTA PERSONAL: ${techName.toUpperCase()}`;
    }
}

window.clearTechFilter = function() {
    activeTechIdFilter = null;
    
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    
    document.getElementById('tech-filter-banner').style.display = 'none';
    document.getElementById('header-app-title').textContent = "CrediLab";
    document.getElementById('header-app-subtitle').textContent = "CONTROL INTEGRADO DE PROCESOS";
    
    const techSelectRepair = document.getElementById('eq-tech-assign');
    if (techSelectRepair) {
        techSelectRepair.disabled = false;
        techSelectRepair.value = "";
    }
    
    showNotification("Visualización completa restaurada.");
    updateRepairsMetrics();
    renderRepairsPipeline();
};


// =========================================================================
// === CONTROL DE VISTAS (MODULARIZACIÓN) ===
// =========================================================================
const btnModRepairs = document.getElementById('btn-mod-repairs');
const btnModInventory = document.getElementById('btn-mod-inventory');
const btnModStaff = document.getElementById('btn-mod-staff');
const btnModTv = document.getElementById('btn-mod-tv');

const viewRepairs = document.getElementById('module-repairs');
const viewInventory = document.getElementById('module-inventory');
const viewStaff = document.getElementById('module-staff');
const viewTv = document.getElementById('module-tv');

function switchModule(moduleName) {
    btnModRepairs.classList.remove('active');
    btnModInventory.classList.remove('active');
    btnModStaff.classList.remove('active');
    btnModTv.classList.remove('active');
    
    viewRepairs.classList.remove('active');
    viewInventory.classList.remove('active');
    viewStaff.classList.remove('active');
    viewTv.classList.remove('active');

    if (moduleName === 'repairs') {
        btnModRepairs.classList.add('active');
        viewRepairs.classList.add('active');
        
        updateRepairsMetrics();
        renderRepairsPipeline();
        populateTechniciansDropdowns();
    } else if (moduleName === 'inventory') {
        btnModInventory.classList.add('active');
        viewInventory.classList.add('active');
        
        updateInventoryMetrics();
        renderInventoryTable();
    } else if (moduleName === 'staff') {
        btnModStaff.classList.add('active');
        viewStaff.classList.add('active');
        
        updateStaffMetrics();
        populateTechniciansDropdowns();
        renderTechniciansList();
        renderToolsTable();
    } else if (moduleName === 'tv') {
        btnModTv.classList.add('active');
        viewTv.classList.add('active');
        
        renderTvDashboard();
    }
    
    createIconsSafe();
}

btnModRepairs.addEventListener('click', () => switchModule('repairs'));
btnModInventory.addEventListener('click', () => switchModule('inventory'));
btnModStaff.addEventListener('click', () => switchModule('staff'));
btnModTv.addEventListener('click', () => switchModule('tv'));


// =========================================================================
// === LÓGICA DE REPARACIONES Y PIPELINE (ESTACIONES) ===
// =========================================================================

function updateRepairsMetrics() {
    const counts = { diagnostico: 0, apertura: 0, pruebas: 0, limpieza: 0 };
    
    let activeOrders = repairOrders.filter(r => r.status === 'active');
    
    if (activeTechIdFilter) {
        activeOrders = activeOrders.filter(r => r.technicianId === activeTechIdFilter);
    }

    activeOrders.forEach(r => {
        if (counts[r.station] !== undefined) {
            counts[r.station]++;
        }
    });

    document.getElementById('metric-recibo').textContent = counts.diagnostico;
    document.getElementById('metric-taller').textContent = counts.apertura;
    document.getElementById('metric-software').textContent = counts.pruebas + counts.limpieza;
    
    const totalCount = activeOrders.length;
    const finishedCount = counts.limpieza;
    
    let efficiency = 100;
    if (totalCount > 0) {
        efficiency = Math.round((finishedCount / totalCount) * 100);
    }
    document.getElementById('metric-repairs-eff').textContent = `${efficiency}%`;
    
    STATIONS.forEach(station => {
        const el = document.getElementById(`count-${station}`);
        if(el) el.textContent = counts[station];
        
        // --- CONTROL Y ADVERTENCIAS DE LÍMITE DE WIP (Lean Flow: WIP > 1) ---
        const laneEl = document.getElementById(`lane-${station}`);
        if (laneEl) {
            if (counts[station] > 1) {
                laneEl.classList.add('lane-wip-warning');
                if (!laneEl.querySelector('.wip-alert-text')) {
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'wip-alert-text';
                    alertDiv.style.cssText = 'color:var(--danger); font-size:10px; font-weight:700; text-align:center; margin-top:5px; margin-bottom:5px;';
                    alertDiv.innerHTML = '⚠️ EXCESO WIP (One-Piece Flow > 1)';
                    laneEl.querySelector('.lane-header').insertAdjacentElement('afterend', alertDiv);
                }
            } else {
                laneEl.classList.remove('lane-wip-warning');
                const alertDiv = laneEl.querySelector('.wip-alert-text');
                if (alertDiv) alertDiv.remove();
            }
        }
    });
}

function formatTimeElapsed(ms) {
    const minutes = Math.floor(ms / (60 * 1000));
    if (minutes < 60) return `${minutes} min`;
    
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    if (hours < 24) return `${hours}h ${remMin}m`;
    
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
}

function renderRepairsPipeline() {
    STATIONS.forEach(station => {
        const el = document.getElementById(`cards-${station}`);
        if(el) el.innerHTML = '';
    });
    
    let activeOrders = repairOrders.filter(r => r.status === 'active');
    
    if (activeTechIdFilter) {
        activeOrders = activeOrders.filter(r => r.technicianId === activeTechIdFilter);
    }
    
    activeOrders.forEach(repair => {
        const absoluteIndex = repairOrders.findIndex(r => r.id === repair.id);
        const laneEl = document.getElementById(`cards-${repair.station}`);
        
        if (!laneEl) return;
        
        const card = document.createElement('div');
        card.className = 'process-card animate-fade-in';
        
        const techMatch = technicians.find(t => t.id === repair.technicianId);
        const techName = techMatch ? techMatch.name : 'Sin Asignar';
        
        // Calcular tiempo de estadía en la estación actual (con fallback seguro en timeline)
        const activeTimestamp = repair.timeline[repair.station] || repair.timeline.diagnostico || Date.now();
        const stayTimeMs = Date.now() - activeTimestamp;
        const stayTimeStr = formatTimeElapsed(stayTimeMs);
        
        const currentStationIndex = STATIONS.indexOf(repair.station);
        const hasPrev = currentStationIndex > 0;
        const hasNext = currentStationIndex < STATIONS.length - 1;
        
        const prevBtn = hasPrev 
            ? `<button class="card-nav-btn" onclick="moveEquipment(${absoluteIndex}, -1)"><i data-lucide="chevron-left"></i> Atrás</button>` 
            : `<button class="card-nav-btn" disabled style="opacity:0.3; cursor:not-allowed;"><i data-lucide="chevron-left"></i> Atrás</button>`;
            
        // Botón especial de desvío (Bypass Apertura) en Diagnóstico
        let bypassBtn = "";
        if (repair.station === 'diagnostico') {
            bypassBtn = `<button class="card-nav-btn" onclick="bypassApertura(${absoluteIndex})" style="background:rgba(255, 198, 0, 0.1); color:var(--ochre-dark); border-color:var(--ochre-yellow); font-size:10px; font-weight:700;" title="Bypass de mesa de desensamble"><i data-lucide="zap"></i> No Abrir</button>`;
        }

        const nextBtn = hasNext 
            ? `<button class="card-nav-btn" onclick="moveEquipment(${absoluteIndex}, 1)">Avanzar <i data-lucide="chevron-right"></i></button>` 
            : `<button class="card-nav-btn" onclick="completeEquipment(${absoluteIndex})" style="background:var(--aquamarine); color:#ffffff; border-color:var(--aquamarine);">Despachar <i data-lucide="check"></i></button>`;
            
        // Alerta especial de flex cables en la mesa de apertura
        let flexWarningHtml = "";
        if (repair.station === 'apertura') {
            flexWarningHtml = `
                <div style="background:rgba(239, 68, 68, 0.08); color:var(--danger); border:1px solid rgba(239, 68, 68, 0.2); font-size:10px; font-weight:800; padding:4px; border-radius:6px; text-align:center; margin-top:4px;">
                    ⚠️ ¡CUIDADO CON EL CABLE FLEX AL ABRIR!
                </div>
            `;
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span class="card-eq-model">${repair.model}</span>
                <button class="card-action-trigger" onclick="deleteRepair(${absoluteIndex})" title="Retirar del flujo">
                    <i data-lucide="x" style="width: 14px; height: 14px;"></i>
                </button>
            </div>
            <span class="card-eq-serial">S/N: ${repair.serial}</span>
            <div class="card-eq-failure">${repair.failureType}</div>
            
            <div class="card-meta-line" style="margin-top:4px;">
                <i data-lucide="user"></i> Técnico: <strong>${techName}</strong>
            </div>

            <div class="card-meta-line" style="margin-top:2px; font-weight:600; color:var(--ochre-dark);">
                <i data-lucide="file-key"></i> SAP PM: <span>${repair.sapPmOrderId || 'Sin Orden'}</span>
            </div>
            <div class="card-meta-line" style="margin-top:2px; font-size:10.5px;">
                <i data-lucide="cpu"></i> Soft: <span>${repair.softwareOperation || 'Ninguna (Hardware)'}</span>
            </div>
            
            ${flexWarningHtml}

            <div class="card-stay-time" title="Tiempo acumulado en esta estación" style="margin-top:5px;">
                <i data-lucide="clock" style="width: 11px; height: 11px;"></i>
                <span>Estadía: ${stayTimeStr}</span>
            </div>
            
            <div style="font-size:10.5px; color:var(--text-primary); font-style:italic; background:#f8fafc; padding:5px; border-radius:6px; border: 1px solid #e2e8f0; margin-top:4px;">
                ${repair.notes ? repair.notes : 'Sin observaciones.'}
            </div>

            <div class="card-nav-controls">
                ${prevBtn}
                ${bypassBtn}
                ${nextBtn}
            </div>
        `;
        
        laneEl.appendChild(card);
    });
    
    createIconsSafe();
}

window.moveEquipment = function(index, delta) {
    const repair = repairOrders[index];
    const currentIndex = STATIONS.indexOf(repair.station);
    const newIndex = currentIndex + delta;
    
    if (newIndex >= 0 && newIndex < STATIONS.length) {
        const oldStation = repair.station;
        repair.station = STATIONS[newIndex];
        
        // Estampar marca de tiempo en la estación si no existía
        if (!repair.timeline[repair.station]) {
            repair.timeline[repair.station] = Date.now();
        }
        
        if (oldStation === 'diagnostico' && repair.station === 'apertura') {
            deductPartForFailure(repair.model, repair.failureType);
        }
        
        saveRepairOrders();
        updateRepairsMetrics();
        renderRepairsPipeline();
        showNotification(`Datáfono avanzado a ${repair.station.toUpperCase()}.`);
    }
};

window.bypassApertura = function(index) {
    const repair = repairOrders[index];
    if (repair.station === 'diagnostico') {
        repair.station = 'pruebas'; // Saltar 'apertura' y pasar directo a 'pruebas'
        
        if (!repair.timeline['pruebas']) {
            repair.timeline['pruebas'] = Date.now();
        }
        
        saveRepairOrders();
        updateRepairsMetrics();
        renderRepairsPipeline();
        showNotification(`Desvío Lean: Datáfono ${repair.serial} enviado directo a PRUEBAS (Bypass Apertura).`);
    }
};

window.completeEquipment = function(index) {
    const rep = repairOrders[index];
    if (confirm(`¿Dar salida técnica final al datáfono S/N: ${rep.serial}?`)) {
        rep.timeline.completed = Date.now();
        rep.status = 'completed';
        
        saveRepairOrders();
        updateRepairsMetrics();
        renderRepairsPipeline();
        showNotification('Equipo archivado en el histórico del taller.');
    }
};

function deductPartForFailure(model, failure) {
    let matchedIndex = -1;
    
    if (failure.includes("Batería")) {
        matchedIndex = inventoryParts.findIndex(p => p.name.toLowerCase().includes("batería") && p.quantity > 0);
    } else if (failure.includes("Puerto")) {
        matchedIndex = inventoryParts.findIndex(p => p.name.toLowerCase().includes("puerto") && p.quantity > 0);
    } else if (failure.includes("Lector")) {
        matchedIndex = inventoryParts.findIndex(p => p.name.toLowerCase().includes("lector") && p.quantity > 0);
    }
    
    if (matchedIndex >= 0) {
        inventoryParts[matchedIndex].quantity -= 1;
        saveInventoryParts();
        showNotification(`Descontado 1 unidad de "${inventoryParts[matchedIndex].name}" de inventario.`);
    }
}

// Alertas de stock en formulario
const selectFailureType = document.getElementById('eq-failure-type');
const selectEqModel = document.getElementById('eq-model');
const formStockAlert = document.getElementById('form-stock-alert');

function syncFormStockAlert() {
    const model = selectEqModel.value;
    const failure = selectFailureType.value;
    
    if (!model || !failure) {
        formStockAlert.style.display = 'none';
        return;
    }
    
    let matchedParts = [];
    
    if (failure.includes("Batería")) {
        matchedParts = inventoryParts.filter(p => p.name.toLowerCase().includes("batería") || p.compatibleModels.includes(model));
    } else if (failure.includes("Puerto")) {
        matchedParts = inventoryParts.filter(p => p.name.toLowerCase().includes("puerto") || p.compatibleModels.includes(model));
    } else if (failure.includes("Lector")) {
        matchedParts = inventoryParts.filter(p => p.name.toLowerCase().includes("lector") || p.compatibleModels.includes(model));
    }
    
    if (matchedParts.length > 0) {
        const primaryPart = matchedParts[0];
        formStockAlert.style.display = 'block';
        
        if (primaryPart.quantity === 0) {
            formStockAlert.style.background = 'rgba(239, 68, 68, 0.05)';
            formStockAlert.style.color = 'var(--terracotta)';
            formStockAlert.style.borderColor = 'var(--terracotta)';
            formStockAlert.innerHTML = `⚠️ <strong>Repuesto agotado:</strong> No hay existencias de <strong>"${primaryPart.name}"</strong>.`;
        } else if (primaryPart.quantity <= primaryPart.minStock) {
            formStockAlert.style.background = 'rgba(255, 198, 0, 0.08)';
            formStockAlert.style.color = 'var(--ochre-dark)';
            formStockAlert.style.borderColor = 'var(--ochre-yellow)';
            formStockAlert.innerHTML = `💡 <strong>Stock Mínimo:</strong> Quedan <strong>${primaryPart.quantity}</strong> unidades en <strong>${primaryPart.location}</strong>.`;
        } else {
            formStockAlert.style.background = 'rgba(0, 175, 170, 0.05)';
            formStockAlert.style.color = 'var(--aquamarine)';
            formStockAlert.style.borderColor = 'var(--aquamarine)';
            formStockAlert.innerHTML = `✅ <strong>Repuestos OK:</strong> Hay <strong>${primaryPart.quantity}</strong> unidades de <strong>"${primaryPart.name}"</strong> en <strong>${primaryPart.location}</strong>.`;
        }
    } else {
        formStockAlert.style.display = 'none';
    }
}

if (selectFailureType && selectEqModel) {
    selectFailureType.addEventListener('change', syncFormStockAlert);
    selectEqModel.addEventListener('change', syncFormStockAlert);
}

// Ingresar nuevo datáfono
document.getElementById('repair-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const model = document.getElementById('eq-model').value;
    const serial = document.getElementById('eq-serial').value.trim();
    const failureType = document.getElementById('eq-failure-type').value;
    const technicianId = parseInt(document.getElementById('eq-tech-assign').value);
    const station = document.getElementById('eq-station').value;
    const notes = document.getElementById('eq-notes').value.trim();
    
    const duplicate = repairOrders.find(r => r.serial.toLowerCase() === serial.toLowerCase() && r.status === 'active');
    if (duplicate) {
        alert('Este número de serie ya está en proceso en el taller.');
        return;
    }
    
    const timeline = { recibo: Date.now(), diagnostico: null, reparacion: null, software: null, test: null, completed: null };
    timeline[station] = Date.now();
    
    const orderData = {
        id: Date.now(),
        model,
        serial,
        failureType,
        technicianId,
        station,
        notes,
        status: "active",
        timeline
    };
    
    repairOrders.push(orderData);
    saveRepairOrders();
    resetRepairForm();
    updateRepairsMetrics();
    renderRepairsPipeline();
    showNotification('Equipo ingresado al taller.');
});

function deleteRepair(index) {
    if (confirm(`¿Retirar permanentemente el datáfono S/N: ${repairOrders[index].serial}?`)) {
        repairOrders.splice(index, 1);
        saveRepairOrders();
        updateRepairsMetrics();
        renderRepairsPipeline();
        showNotification('Registro eliminado.');
    }
}

function resetRepairForm() {
    document.getElementById('repair-form').reset();
    document.getElementById('form-submit-btn').innerHTML = '<i data-lucide="plus"></i> Ingresar al Proceso';
    formStockAlert.style.display = 'none';
    
    if (activeTechIdFilter) {
        const selectTech = document.getElementById('eq-tech-assign');
        selectTech.value = activeTechIdFilter;
        selectTech.disabled = true;
    }
}


// =========================================================================
// === EXPORTAR INFORMES A EXCEL (CSV) ===
// =========================================================================
window.exportToCSV = function() {
    if(repairOrders.length === 0) {
        alert("No hay datos de reparaciones para exportar.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM
    csvContent += "ID Orden,Modelo de Datáfono,Número de Serie (S/N),Falla Reportada,Técnico Responsable,Estación Actual,Estado General,Fecha Ingreso,Fecha Salida,Tiempo de Ciclo (TAT)\r\n";

    repairOrders.forEach(order => {
        const techMatch = technicians.find(t => t.id === order.technicianId);
        const techName = techMatch ? techMatch.name : "Sin asignar";

        const entryDate = new Date(order.timeline.recibo).toLocaleString('es-CO');
        const exitDate = order.timeline.completed ? new Date(order.timeline.completed).toLocaleString('es-CO') : "N/A";
        
        let tatStr = "En Proceso";
        if(order.timeline.completed) {
            const tatMs = order.timeline.completed - order.timeline.recibo;
            tatStr = formatTimeElapsed(tatMs);
        }

        const row = [
            order.id,
            `"${order.model}"`,
            `"${order.serial}"`,
            `"${order.failureType}"`,
            `"${techName}"`,
            order.station.toUpperCase(),
            order.status.toUpperCase(),
            `"${entryDate}"`,
            `"${exitDate}"`,
            `"${tatStr}"`
        ].join(",");

        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reporte_reparaciones_credilab.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Informe CSV descargado.");
};


// =========================================================================
// === LÓGICA DE ALMACÉN DE REPUESTOS ===
// =========================================================================

function updateInventoryMetrics() {
    const totalCount = inventoryParts.reduce((acc, curr) => acc + curr.quantity, 0);
    const lowStockCount = inventoryParts.filter(p => p.quantity > 0 && p.quantity <= p.minStock).length;
    const outOfStockCount = inventoryParts.filter(p => p.quantity === 0).length;
    
    document.getElementById('metric-inv-total').textContent = totalCount;
    document.getElementById('metric-inv-low').textContent = lowStockCount;
    document.getElementById('metric-inv-out').textContent = outOfStockCount;
    
    let healthPercent = 100;
    const totalItems = inventoryParts.length;
    if (totalItems > 0) {
        const problematicItems = lowStockCount + outOfStockCount;
        healthPercent = Math.round(((totalItems - problematicItems) / totalItems) * 100);
    }
    document.getElementById('metric-inv-status').textContent = `${healthPercent}%`;
}

function renderInventoryTable(filterType = 'all', searchQuery = '') {
    const tbody = document.getElementById('inventory-table-body');
    const noInvMsg = document.getElementById('no-inv-msg');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let filtered = inventoryParts;
    
    if (filterType === 'ok') filtered = filtered.filter(p => p.quantity > p.minStock);
    else if (filterType === 'alert') filtered = filtered.filter(p => p.quantity <= p.minStock);
    
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.compatibleModels.toLowerCase().includes(query) ||
            p.location.toLowerCase().includes(query)
        );
    }
    
    if (filtered.length === 0) {
        noInvMsg.style.display = 'block';
        return;
    } else {
        noInvMsg.style.display = 'none';
    }
    
    filtered.forEach(part => {
        const absoluteIndex = inventoryParts.findIndex(p => p.id === part.id);
        const tr = document.createElement('tr');
        tr.className = 'animate-fade-in';
        
        let statusBadge = '';
        if (part.quantity === 0) statusBadge = '<span class="badge badge-critical">Agotado</span>';
        else if (part.quantity <= part.minStock) statusBadge = '<span class="badge badge-pending">Stock Bajo</span>';
        else statusBadge = '<span class="badge badge-completed">Abastecido</span>';
        
        tr.innerHTML = `
            <td>
                <div class="equipment-cell">
                    <span class="eq-model">${part.name}</span>
                    <span class="eq-serial" style="font-size: 11px; font-family: sans-serif;"><i data-lucide="map-pin" style="width: 10px; height: 10px; display: inline; vertical-align: middle; margin-right: 2px;"></i>${part.location}</span>
                </div>
            </td>
            <td style="font-weight: 600; color:var(--text-primary);">${part.compatibleModels}</td>
            <td>
                <div class="qty-controller">
                    <button class="qty-btn" onclick="adjustPartStock(${absoluteIndex}, -1)">-</button>
                    <span class="qty-val">${part.quantity}</span>
                    <button class="qty-btn" onclick="adjustPartStock(${absoluteIndex}, 1)">+</button>
                </div>
            </td>
            <td>${statusBadge}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn btn-edit" title="Editar" onclick="editInventory(${absoluteIndex})">
                        <i data-lucide="edit-2"></i>
                    </button>
                    <button class="action-btn btn-delete" title="Eliminar" onclick="deleteInventory(${absoluteIndex})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    createIconsSafe();
}

window.adjustPartStock = function(index, delta) {
    const item = inventoryParts[index];
    const newQty = item.quantity + delta;
    
    if (newQty < 0) return;
    
    item.quantity = newQty;
    saveInventoryParts();
    updateInventoryMetrics();
    
    const activeFilter = document.querySelector('#inventory-filters .tab-btn.active').dataset.filter;
    const query = document.getElementById('inventory-search').value;
    renderInventoryTable(activeFilter, query);
    syncFormStockAlert();
    
    if (delta > 0) showNotification(`Aumentado stock de ${item.name}.`);
    else showNotification(`Descontado stock de ${item.name}.`);
};

document.getElementById('inventory-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const editIndex = parseInt(document.getElementById('inv-edit-index').value);
    const name = document.getElementById('part-name').value.trim();
    const compatibleModels = document.getElementById('part-model').value.trim();
    const quantity = parseInt(document.getElementById('part-qty').value);
    const minStock = parseInt(document.getElementById('part-min').value);
    const location = document.getElementById('part-location').value.trim();
    
    if (editIndex >= 0) {
        inventoryParts[editIndex] = { ...inventoryParts[editIndex], name, compatibleModels, quantity, minStock, location };
        showNotification('Repuesto actualizado.');
    } else {
        const duplicate = inventoryParts.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (duplicate) {
            alert('El repuesto ya existe.');
            return;
        }
        inventoryParts.push({ id: Date.now(), name, compatibleModels, quantity, minStock, location });
        showNotification('Repuesto guardado.');
    }
    
    saveInventoryParts();
    resetInventoryForm();
    updateInventoryMetrics();
    renderInventoryTable();
});

function editInventory(index) {
    const part = inventoryParts[index];
    
    document.getElementById('inv-edit-index').value = index;
    document.getElementById('part-name').value = part.name;
    document.getElementById('part-model').value = part.compatibleModels;
    document.getElementById('part-qty').value = part.quantity;
    document.getElementById('part-min').value = part.minStock;
    document.getElementById('part-location').value = part.location;
    
    document.getElementById('inv-submit-btn').innerHTML = '<i data-lucide="refresh-cw"></i> Actualizar Repuesto';
    document.getElementById('inv-cancel-btn').style.display = 'block';
    
    document.getElementById('inventory-form').scrollIntoView({ behavior: 'smooth' });
    createIconsSafe();
}

function deleteInventory(index) {
    if (confirm(`¿Eliminar repuesto "${inventoryParts[index].name}"?`)) {
        inventoryParts.splice(index, 1);
        saveInventoryParts();
        updateInventoryMetrics();
        renderInventoryTable();
        showNotification('Repuesto eliminado.');
    }
}

function resetInventoryForm() {
    document.getElementById('inv-edit-index').value = "-1";
    document.getElementById('inventory-form').reset();
    document.getElementById('inv-submit-btn').innerHTML = '<i data-lucide="save"></i> Guardar en Almacén';
    document.getElementById('inv-cancel-btn').style.display = 'none';
}

if (document.getElementById('inv-cancel-btn')) {
    document.getElementById('inv-cancel-btn').addEventListener('click', resetInventoryForm);
}


// =========================================================================
// === LÓGICA DE PERSONAL & HERRAMIENTAS ===
// =========================================================================

function updateStaffMetrics() {
    const techCount = technicians.length;
    const toolsCount = tools.length;
    const unassignedCount = tools.filter(t => !t.assignedTo || t.assignedTo === "").length;
    
    document.getElementById('metric-tech-count').textContent = techCount;
    document.getElementById('metric-tools-count').textContent = toolsCount;
    document.getElementById('metric-tools-unassigned').textContent = unassignedCount;
}

function populateTechniciansDropdowns() {
    const techSelectRepair = document.getElementById('eq-tech-assign');
    const techSelectTool = document.getElementById('tool-tech');
    
    if(!techSelectRepair || !techSelectTool) return;
    
    techSelectRepair.innerHTML = '<option value="" disabled selected>Selecciona técnico...</option>';
    techSelectTool.innerHTML = '<option value="" disabled selected>Asigna un responsable...</option>';
    
    technicians.forEach(t => {
        const optRepair = document.createElement('option');
        optRepair.value = t.id;
        optRepair.textContent = t.name;
        techSelectRepair.appendChild(optRepair);

        const optTool = document.createElement('option');
        optTool.value = t.id;
        optTool.textContent = t.name;
        techSelectTool.appendChild(optTool);
    });
    
    if (activeTechIdFilter) {
        techSelectRepair.value = activeTechIdFilter;
        techSelectRepair.disabled = true;
    }
}

window.copyTechLink = function(techId, techName) {
    const base = window.location.origin + window.location.pathname;
    const personalLink = `${base}?tech=${techId}`;
    
    navigator.clipboard.writeText(personalLink).then(() => {
        showNotification(`¡Enlace copiado para ${techName}!`);
    }).catch(err => {
        console.error("Error al copiar enlace:", err);
        alert(`Copia manual de enlace: ${personalLink}`);
    });
};

function renderTechniciansList() {
    const container = document.getElementById('tech-cards-container');
    if(!container) return;
    container.innerHTML = '';
    
    technicians.forEach(tech => {
        const techTools = tools.filter(t => t.assignedTo === tech.id).map(t => t.name);
        const stationBadges = tech.permissions.map(st => `<span class="tech-station-badge">${st.toUpperCase()}</span>`).join('');
        
        const card = document.createElement('div');
        card.className = 'tech-profile-card animate-fade-in';
        
        card.innerHTML = `
            <div class="tech-profile-header">
                <span class="tech-profile-name">${tech.name}</span>
                <span class="tech-profile-role">${tech.specialty}</span>
            </div>
            <div class="tech-profile-body">
                <div>🛠️ <strong>Herramientas Custodiadas:</strong></div>
                <div style="font-size:11px; color:var(--text-primary); margin-left:5px; margin-bottom:4px;">
                    ${techTools.length > 0 ? techTools.map(t => `• ${t}`).join('<br>') : '• Ninguna herramienta asignada.'}
                </div>
                <div>⚡ <strong>Permisos de Estación:</strong></div>
                <div>${stationBadges}</div>
                
                <button class="tech-link-btn" onclick="copyTechLink(${tech.id}, '${tech.name}')">
                    <i data-lucide="link"></i> Copiar Enlace Personal
                </button>
            </div>
        `;
        container.appendChild(card);
    });
    createIconsSafe();
}

function renderToolsTable() {
    const tbody = document.getElementById('tools-table-body');
    const noToolsMsg = document.getElementById('no-tools-msg');
    
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if (tools.length === 0) {
        noToolsMsg.style.display = 'block';
        return;
    } else {
        noToolsMsg.style.display = 'none';
    }
    
    tools.forEach((tool, index) => {
        const techMatch = technicians.find(t => t.id === tool.assignedTo);
        const techName = techMatch ? techMatch.name : 'Sin asignar';
        
        const tr = document.createElement('tr');
        tr.className = 'animate-fade-in';
        
        tr.innerHTML = `
            <td>
                <div class="equipment-cell">
                    <span class="eq-model">${tool.name}</span>
                    <span class="eq-serial">${tool.code}</span>
                </div>
            </td>
            <td style="font-weight:600;">${techName}</td>
            <td><span class="badge badge-completed">Bajo Custodia</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn btn-delete" title="Retirar" onclick="deleteTool(${index})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    createIconsSafe();
}

// Crear técnico
if (document.getElementById('tech-form')) {
    document.getElementById('tech-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('tech-name').value.trim();
        const specialty = document.getElementById('tech-specialty').value;
        
        const permissions = [];
        if(document.getElementById('perm-recibo').checked) permissions.push('recibo');
        if(document.getElementById('perm-diagnostico').checked) permissions.push('diagnostico');
        if(document.getElementById('perm-reparacion').checked) permissions.push('reparacion');
        if(document.getElementById('perm-software').checked) permissions.push('software');
        if(document.getElementById('perm-test').checked) permissions.push('test');
        
        if(permissions.length === 0) {
            alert('Debe asignar al menos una estación de permiso.');
            return;
        }
        
        technicians.push({ id: Date.now(), name, specialty, permissions });
        saveTechnicians();
        document.getElementById('tech-form').reset();
        showNotification('Técnico registrado.');
        
        updateStaffMetrics();
        populateTechniciansDropdowns();
        renderTechniciansList();
    });
}

// Crear y asignar herramientas
if (document.getElementById('tool-form')) {
    document.getElementById('tool-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('tool-name').value.trim();
        const code = document.getElementById('tool-code').value.trim();
        const assignedTo = parseInt(document.getElementById('tool-tech').value);
        
        tools.push({ id: Date.now(), name, code, assignedTo });
        saveTools();
        document.getElementById('tool-form').reset();
        showNotification('Herramienta registrada.');
        
        updateStaffMetrics();
        renderTechniciansList();
        renderToolsTable();
    });
}

window.deleteTool = function(index) {
    if (confirm(`¿Retirar herramienta "${tools[index].name}"?`)) {
        tools.splice(index, 1);
        saveTools();
        updateStaffMetrics();
        renderTechniciansList();
        renderToolsTable();
        showNotification('Herramienta dada de baja.');
    }
};


// =========================================================================
// === LÓGICA DE MONITOR DE TV (PANTALLA DE TALLER) ===
// =========================================================================

function renderTvDashboard() {
    const container = document.getElementById('tv-team-progress-container');
    const alertsContainer = document.getElementById('tv-critical-stock-alerts');
    const tickerMsg = document.getElementById('tv-ticker-msg');
    
    if (!container || !alertsContainer) return;
    
    container.innerHTML = '';
    alertsContainer.innerHTML = '';
    
    // --- 1. CARGAR ESCALAFÓN DE TRABAJO ---
    technicians.forEach(tech => {
        // Órdenes asignadas y activas
        const activeTasks = repairOrders.filter(r => r.technicianId === tech.id && r.status === 'active' && r.station !== 'test').length;
        // Órdenes en la estación de test final
        const finishedTasks = repairOrders.filter(r => r.technicianId === tech.id && r.status === 'active' && r.station === 'test').length;
        
        const total = activeTasks + finishedTasks;
        const percent = total > 0 ? Math.round((finishedTasks / total) * 100) : 0;
        
        const card = document.createElement('div');
        card.className = 'team-progress-card animate-fade-in';
        
        card.innerHTML = `
            <div class="team-progress-header">
                <span class="team-tech-name">${tech.name}</span>
                <span class="team-tech-specialty">${tech.specialty}</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-labels">
                    <span>Avance de Tareas Activas</span>
                    <span>${percent}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                </div>
            </div>
            <div class="team-stats-row">
                <span>📋 Asignados: <strong>${activeTasks}</strong></span>
                <span>🧪 Listos en QA: <strong>${finishedTasks}</strong></span>
            </div>
        `;
        container.appendChild(card);
    });
    
    // --- 2. CARGAR TOTALES GIGANTES ---
    const activeCount = repairOrders.filter(r => r.status === 'active').length;
    document.getElementById('tv-total-active').textContent = activeCount;
    
    const completedCount = repairOrders.filter(r => r.status === 'active' && r.station === 'test').length;
    let efficiency = 100;
    if (activeCount > 0) {
        efficiency = Math.round((completedCount / activeCount) * 100);
    }
    document.getElementById('tv-efficiency-val').textContent = `${efficiency}%`;
    
    // --- 3. CÁLCULO E INYECCIÓN DEL KPI "TAT" PROMEDIO ---
    const completedOrders = repairOrders.filter(r => r.status === 'completed');
    let avgTatStr = "1d 4h"; // Default si no hay histórico
    
    if (completedOrders.length > 0) {
        const totalTatMs = completedOrders.reduce((sum, order) => {
            return sum + (order.timeline.completed - order.timeline.recibo);
        }, 0);
        const avgTatMs = totalTatMs / completedOrders.length;
        avgTatStr = formatTimeElapsed(avgTatMs);
    }
    document.getElementById('tv-tat-val').textContent = avgTatStr;
    
    // --- 4. CARGAR ALERTAS CRÍTICAS ---
    const criticalStock = inventoryParts.filter(p => p.quantity === 0);
    if(criticalStock.length === 0) {
        alertsContainer.innerHTML = `
            <div style="color: var(--aquamarine); font-weight:600; padding:10px; border-radius:6px; background:rgba(0,175,170,0.05); text-align:center;">
                ✅ Almacén abastecido. Sin faltantes.
            </div>
        `;
    } else {
        criticalStock.forEach(p => {
            const el = document.createElement('div');
            el.style.background = 'rgba(239, 68, 68, 0.05)';
            el.style.color = 'var(--terracotta)';
            el.style.padding = '8px 12px';
            el.style.borderRadius = '6px';
            el.style.borderLeft = '4px solid var(--terracotta)';
            el.style.fontWeight = '600';
            el.innerHTML = `🚨 AGOTADO: "${p.name}" (Ubicación: ${p.location})`;
            alertsContainer.appendChild(el);
        });
    }
    
    // --- 5. CARGAR TICKER DE NOTICIAS ---
    if(completedOrders.length > 0) {
        const last = completedOrders[completedOrders.length - 1];
        const techMatch = technicians.find(t => t.id === last.technicianId);
        const techName = techMatch ? techMatch.name : "Técnico";
        tickerMsg.innerHTML = `🎉 Último datáfono despachado: <strong>${last.model} (S/N: ${last.serial})</strong> completado exitosamente por <strong>${techName}</strong>.`;
    } else {
        tickerMsg.innerHTML = `📈 El laboratorio central de Credibanco opera con un 100% de efectividad en Bogotá.`;
    }
}


// =========================================================================
// === SOPORTE COMÚN (FECHA, NOTIFICACIONES Y EVENTOS) ===
// =========================================================================

function showNotification(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = 'var(--grad-brand)';
    toast.style.color = '#000000';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = 'var(--hover-shadow)';
    toast.style.fontSize = '13.5px';
    toast.style.fontWeight = '700';
    toast.style.zIndex = '1000';
    toast.style.fontFamily = 'Outfit, sans-serif';
    toast.style.animation = 'fadeIn 0.3s ease';
    
    toast.textContent = msg;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 2800);
}

function updateLiveTime() {
    const timeEl = document.getElementById('live-time');
    if (!timeEl) return;
    
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    };
    timeEl.textContent = now.toLocaleDateString('es-CO', options);
}

// --- LÓGICA DE PROTOCOLOS DE DIAGNÓSTICO ---
function renderDiagnostics(searchQuery = '') {
    const container = document.getElementById('diagnostic-results');
    if (!container) return;
    container.innerHTML = '';
    
    let filtered = DIAGNOSTIC_DATABASE;
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filtered = DIAGNOSTIC_DATABASE.filter(d => 
            d.title.toLowerCase().includes(query) || 
            d.desc.toLowerCase().includes(query) || 
            d.brand.toLowerCase().includes(query) ||
            d.steps.some(step => step.toLowerCase().includes(query)) ||
            d.tip.toLowerCase().includes(query)
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 40px 0;">
                <i data-lucide="search-code" style="width: 32px; height: 32px; margin-bottom: 5px; opacity: 0.5;"></i>
                <p>No se encontraron guías para la búsqueda.</p>
            </div>
        `;
        createIconsSafe();
        return;
    }
    
    filtered.forEach(d => {
        const card = document.createElement('div');
        card.style.background = '#f8fafc';
        card.style.border = '1px solid #cbd5e1';
        card.style.borderRadius = '10px';
        card.style.padding = '15px';
        card.style.marginBottom = '15px';
        card.className = 'animate-fade-in';
        
        const stepsHtml = d.steps.map((step, idx) => `
            <li style="margin-bottom: 6px; font-size: 12.5px;">
                <strong>Paso ${idx + 1}:</strong> ${step}
            </li>
        `).join('');
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <h3 style="font-size: 14.5px; color: var(--text-primary); font-weight: 700; margin-bottom: 0;">${d.title}</h3>
                <span class="tech-profile-role" style="font-size: 10px; background: rgba(0, 175, 170, 0.08); color: var(--aquamarine); padding: 2px 6px; border-radius: 10px; font-weight: 600; text-transform: uppercase;">${d.brand}</span>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; font-style: italic;">${d.desc}</p>
            <ol style="margin-left: 15px; margin-bottom: 10px; color: var(--text-primary);">
                ${stepsHtml}
            </ol>
            <div style="background: rgba(255, 198, 0, 0.06); border: 1px solid rgba(255, 198, 0, 0.2); color: var(--ochre-dark); padding: 8px 12px; border-radius: 8px; font-size: 11.5px; display: flex; gap: 6px; align-items: flex-start;">
                <i data-lucide="lightbulb" style="width: 16px; height: 16px; flex-shrink: 0; color: var(--ochre-dark); margin-top: 1px;"></i>
                <span><strong>Consejo de taller:</strong> ${d.tip}</span>
            </div>
        `;
        container.appendChild(card);
    });
    
    createIconsSafe();
}

// --- EVENTOS BÚSQUEDA ---
if (document.getElementById('inventory-search')) {
    document.getElementById('inventory-search').addEventListener('input', function(e) {
        const activeFilter = document.querySelector('#inventory-filters .tab-btn.active').dataset.filter;
        renderInventoryTable(activeFilter, e.target.value);
    });
}

document.querySelectorAll('#inventory-filters .tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('#inventory-filters .tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const filter = this.dataset.filter;
        const searchQuery = document.getElementById('inventory-search').value;
        renderInventoryTable(filter, searchQuery);
    });
});

if (document.getElementById('diagnostic-input')) {
    document.getElementById('diagnostic-input').addEventListener('input', function(e) {
        renderDiagnostics(e.target.value);
    });
}

// Refrescar automáticamente los tiempos de estadía de las tarjetas cada minuto
setInterval(() => {
    const activeView = document.querySelector('.nav-tab.active');
    if (activeView && activeView.id === 'btn-mod-repairs') {
        renderRepairsPipeline();
    }
}, 60000);


// --- CARGA INICIAL ---
document.addEventListener('DOMContentLoaded', () => {
    initData();
    
    updateRepairsMetrics();
    renderRepairsPipeline();
    
    if (document.getElementById('diagnostic-results')) {
        renderDiagnostics();
    }
    
    populateTechniciansDropdowns();
    
    updateLiveTime();
    setInterval(updateLiveTime, 1000);
});
