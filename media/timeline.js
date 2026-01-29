/* global document, acquireVsCodeApi */

const vscode = acquireVsCodeApi();
const track = document.querySelector(".timeline-track");
let isDown = false, startX, scrollLeft;
let lastOpenedId = null;

// ============================================
// Configuración de colores por rama
// ============================================
const branchColors = [
    '#59C2FF', // blue
    '#BAE67E', // green
    '#FFAA44', // orange
    '#F29BC2'  // pink
];

// ============================================
// Utilidades
// ============================================
function formatTimestamp(ts) {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month} - ${hours}:${mins}`;
}

function getBranchIndex(index) {
    return index % branchColors.length;
}

// ============================================
// Renderizar grid de fondo
// ============================================
function renderGrid() {
    const canvas = document.getElementById('grid-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const wrapper = document.querySelector('.git-graph-wrapper');

    canvas.width = wrapper.offsetWidth;
    canvas.height = wrapper.offsetHeight;

    const gridSpacing = 100; // px entre líneas
    const gridOpacity = 0.06;

    ctx.strokeStyle = `rgba(230, 225, 207, ${gridOpacity})`;
    ctx.lineWidth = 1;

    // Líneas verticales
    for (let x = gridSpacing; x < canvas.width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}

// ============================================
// Renderizar líneas de rama (SVG)
// ============================================
function renderBranchLines() {
    const svg = document.getElementById('graph-svg');
    const branchesLayer = document.getElementById('branches-layer');
    const wrapper = document.querySelector('.git-graph-wrapper');
    const track = document.querySelector('.timeline-track');

    if (!svg || !branchesLayer || !wrapper) return;

    const nodes = Array.from(document.querySelectorAll('.node'));
    if (nodes.length < 2) return;

    // Obtener dimensiones reales del contenedor
    const wrapperRect = wrapper.getBoundingClientRect();

    // El SVG debe ser del mismo tamaño que el wrapper
    svg.setAttribute('width', wrapperRect.width);
    svg.setAttribute('height', wrapperRect.height);

    // Limpiar líneas existentes
    branchesLayer.innerHTML = '';

    // Calcular posiciones de los nodos
    const nodePositions = [];

    nodes.forEach((node, index) => {
        const dotContainer = node.querySelector('.dot-container');
        const rect = dotContainer.getBoundingClientRect();

        // Posición relativa al wrapper (teniendo en cuenta el scroll)
        const x = rect.left - wrapperRect.left + (rect.width / 2);
        const y = rect.top - wrapperRect.top + (rect.height / 2) - 10; // Ajuste manual hacia arriba

        nodePositions.push({
            x: x,
            y: y,
            branchIndex: getBranchIndex(index)
        });

        // Debug: agregar círculo en el centro calculado
        if (window.DEBUG_LINES) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '3');
            circle.setAttribute('fill', 'red');
            circle.setAttribute('opacity', '0.5');
            branchesLayer.appendChild(circle);
        }
    });

    // Crear líneas entre nodos consecutivos
    for (let i = 0; i < nodePositions.length - 1; i++) {
        const start = nodePositions[i];
        const end = nodePositions[i + 1];

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        const dx = end.x - start.x;

        // Si los nodos están muy cerca, línea recta
        // Si están lejos, curva suave
        let pathData;
        if (Math.abs(dx) < 100) {
            pathData = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        } else {
            const controlOffset = Math.min(Math.abs(dx) * 0.3, 50);
            pathData = `M ${start.x} ${start.y} 
                       C ${start.x + controlOffset} ${start.y}, 
                         ${end.x - controlOffset} ${end.y}, 
                         ${end.x} ${end.y}`;
        }

        path.setAttribute('d', pathData);
        path.classList.add('branch-line', `branch-${start.branchIndex}`);
        path.setAttribute('data-branch', start.branchIndex);

        branchesLayer.appendChild(path);
    }

    console.log('Líneas renderizadas. Nodos:', nodePositions.length, 'SVG size:', svg.getAttribute('width'), 'x', svg.getAttribute('height'));
}

// ============================================
// Mostrar detalles del snapshot
// ============================================
function showDetails(snapshot) {
    const panel = document.getElementById("snapshot-details");

    document.getElementById("detail-title").textContent = snapshot.name || "(sin nombre)";
    document.getElementById("detail-timestamp").textContent = formatTimestamp(snapshot.timestamp);
    document.getElementById("detail-comment").textContent = snapshot.comment || "(sin comentario)";
    document.getElementById("detail-content").textContent = snapshot.content;

    document.getElementById("btn-restore").onclick = () => {
        vscode.postMessage({ command: "restore", snapshot });
    };

    document.getElementById("btn-delete").onclick = () => {
        vscode.postMessage({ command: "delete", snapshot });
    };

    document.getElementById("btn-close").onclick = () => {
        closePanel();
    };
}

function closePanel() {
    const panel = document.getElementById("snapshot-details");
    panel.classList.add("hidden");
    panel.dataset.openId = "";
    lastOpenedId = null;

    // Remover estado activo de todos los nodos
    document.querySelectorAll('.node').forEach(n => {
        n.classList.remove('active', 'dimmed');
    });

    // Remover estado de las líneas
    document.querySelectorAll('.branch-line').forEach(line => {
        line.classList.remove('active', 'dimmed');
    });
}

// ============================================
// Manejar selección de nodos
// ============================================
function selectNode(nodeElement, snapshot) {
    const panel = document.getElementById("snapshot-details");
    const id = nodeElement.dataset.id;

    // Si se hace clic en el mismo nodo, cerrar panel
    if (panel.dataset.openId === id) {
        closePanel();
        return;
    }

    // Actualizar estado visual de los nodos
    const allNodes = document.querySelectorAll('.node');
    allNodes.forEach(n => {
        if (n === nodeElement) {
            n.classList.add('active');
            n.classList.remove('dimmed');
        } else {
            n.classList.remove('active');
            n.classList.add('dimmed');
        }
    });

    // Actualizar estado visual de las líneas
    const branchIndex = getBranchIndex(Array.from(allNodes).indexOf(nodeElement));
    const allLines = document.querySelectorAll('.branch-line');
    allLines.forEach(line => {
        const lineBranch = parseInt(line.getAttribute('data-branch'));
        if (lineBranch === branchIndex) {
            line.classList.add('active');
            line.classList.remove('dimmed');
        } else {
            line.classList.remove('active');
            line.classList.add('dimmed');
        }
    });

    // Mostrar panel
    showDetails(snapshot);
    panel.classList.remove("hidden");
    panel.dataset.openId = id;
    lastOpenedId = id;
}

// ============================================
// Event listeners para nodos
// ============================================
document.querySelectorAll(".node").forEach((node, index) => {
    // Asignar clase de rama basada en el índice
    const branchIndex = getBranchIndex(index);
    node.classList.add(`branch-${branchIndex}`);

    node.addEventListener("click", () => {
        const id = node.dataset.id;
        const snap = snapshots.find(s => String(s.timestamp) === id);

        if (!snap) {
            console.error("Snapshot no encontrado:", id);
            return;
        }

        selectNode(node, snap);
    });

    // Efecto hover en las líneas de rama
    node.addEventListener("mouseenter", () => {
        const allLines = document.querySelectorAll('.branch-line');
        const nodeBranch = getBranchIndex(index);

        allLines.forEach(line => {
            const lineBranch = parseInt(line.getAttribute('data-branch'));
            if (lineBranch === nodeBranch && !line.classList.contains('dimmed')) {
                line.style.opacity = '1';
            }
        });
    });

    node.addEventListener("mouseleave", () => {
        const allLines = document.querySelectorAll('.branch-line');

        allLines.forEach(line => {
            if (!line.classList.contains('active')) {
                line.style.opacity = '';
            }
        });
    });
});

// ============================================
// Inicialización
// ============================================
function init() {
    renderGrid();

    // Esperar un momento para que el DOM esté completamente renderizado
    setTimeout(() => {
        renderBranchLines();
    }, 10);

    // Re-renderizar en resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            renderGrid();
            renderBranchLines();
        }, 150);
    });

    // Re-renderizar líneas al hacer scroll
    let scrollTimeout;
    track.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            renderBranchLines();
        }, 50);
    });
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

const viewport = document.getElementById("viewport");
const world = document.getElementById("world");

let scale = 1;
let offsetX = 0;
let offsetY = 0;

let isPanning = false;
let lastX = 0;
let lastY = 0;

// Bloquear menú contextual
viewport.addEventListener("contextmenu", e => e.preventDefault());

// ---- PAN con click derecho ----
viewport.addEventListener("mousedown", e => {
    if (e.button !== 2) return; // solo botón derecho
    isPanning = true;
    lastX = e.clientX;
    lastY = e.clientY;
});

viewport.addEventListener("mousemove", e => {
    if (!isPanning) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    offsetX += dx;
    offsetY += dy;

    lastX = e.clientX;
    lastY = e.clientY;

    applyTransform();
});

['mouseup', 'mouseleave'].forEach(ev =>
    viewport.addEventListener(ev, () => isPanning = false)
);

// ---- ZOOM con Ctrl + wheel ----
viewport.addEventListener("wheel", e => {
    if (!e.ctrlKey) return;
    e.preventDefault();

    const zoomIntensity = 0.1;
    const oldScale = scale;

    if (e.deltaY < 0) scale *= 1 + zoomIntensity;
    else scale *= 1 - zoomIntensity;

    scale = Math.min(Math.max(scale, 0.2), 4);

    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const ratio = scale / oldScale;
    offsetX = cx - (cx - offsetX) * ratio;
    offsetY = cy - (cy - offsetY) * ratio;

    applyTransform();
}, { passive: false });

// ---- Aplicar transform ----
function applyTransform() {
    world.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    world.style.zoom = scale;


}
