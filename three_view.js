/*
   ====================================================
   Avatar 2 Digital Layout - 3D Digital Twin Scene
   ====================================================
*/

// 3D Engine State
let scene, camera, renderer, controls;
let plotMeshes = [];
let is3DActive = false;
let animationFrameId = null;
let currentHoveredPlot = null;

// Raycasting parameters
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Load event listener for 3D view toggle
document.addEventListener('DOMContentLoaded', () => {
    setup3DControls();
});

// Setup Toggle Button and Views
function setup3DControls() {
    const toggle3dBtn = document.getElementById('toggle3dBtn');
    const threeContainer = document.getElementById('threeCanvasContainer');
    const mapContainer = document.getElementById('mapContainer');
    const mapTip = document.getElementById('mapTip');

    if (!toggle3dBtn || !threeContainer || !mapContainer) return;

    toggle3dBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        is3DActive = !is3DActive;

        if (is3DActive) {
            toggle3dBtn.classList.add('active');
            toggle3dBtn.title = "View in 2D Mode";
            toggle3dBtn.innerHTML = '<i class="fa-solid fa-map"></i>';

            // Hide 2D map & show 3D canvas
            mapContainer.style.display = 'none';
            threeContainer.style.display = 'block';
            if (mapTip) {
                mapTip.innerHTML = '<i class="fa-solid fa-arrows-spin"></i> Left-Click + Drag to Rotate &bull; Right-Click + Drag to Pan &bull; Scroll to Zoom';
            }

            // Initialize or start render loop
            if (!scene) {
                initThreeScene();
            } else {
                startRendering();
            }
            
            // Auto resize to fit parent dimensions
            onWindowResize();
        } else {
            toggle3dBtn.classList.remove('active');
            toggle3dBtn.title = "View in 3D Mode";
            toggle3dBtn.innerHTML = '<i class="fa-solid fa-cube"></i>';

            // Hide 3D canvas & show 2D map
            threeContainer.style.display = 'none';
            mapContainer.style.display = 'block';
            if (mapTip) {
                mapTip.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Drag to Pan &bull; Scroll or Pinch to Zoom';
            }

            // Stop loop
            stopRendering();
        }
    });

    // Handle hover / clicks
    threeContainer.addEventListener('mousemove', onMouseMove);
    threeContainer.addEventListener('click', onMouseClick);
}

// ----------------------------------------------------
// Three.js Scene Setup
// ----------------------------------------------------

function initThreeScene() {
    const container = document.getElementById('threeCanvasContainer');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // White background matching map

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    // Position camera at a nice high-angle isometric perspective
    camera.position.set(0, 50, 60);

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05; // Prevent camera going below ground
    controls.minDistance = 15;
    controls.maxDistance = 120;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(20, 60, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    
    // Set orthographic bounds for shadows to cover map area (102.4x64.6)
    const d = 60;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Subtle blue fill light from opposite angle
    const fillLight = new THREE.DirectionalLight(0xa5c5f5, 0.25);
    fillLight.position.set(-30, 20, -30);
    scene.add(fillLight);

    // 6. Textured Ground Plane (using map_layout.jpg)
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('map_layout.jpg', (texture) => {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        
        // Ground Size matches 1024x646 scale (factor of 0.1)
        const groundGeo = new THREE.PlaneGeometry(102.4, 64.6);
        const groundMat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.9,
            metalness: 0.05,
            side: THREE.DoubleSide
        });

        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Generate elements once ground is loaded
        generatePlotMeshes();
        generateProceduralForest();
        generateStreetlights();
        generateEntranceArch();

        // Start animating
        startRendering();
    });

    window.addEventListener('resize', onWindowResize);
}

// ----------------------------------------------------
// 3D Object Generation
// ----------------------------------------------------

function generatePlotMeshes() {
    if (typeof plotCoordinates === 'undefined' || typeof plotData === 'undefined') return;

    plotMeshes.forEach(mesh => scene.remove(mesh));
    plotMeshes = [];

    Object.keys(plotCoordinates).forEach(plotNo => {
        const coords = plotCoordinates[plotNo];
        
        // Map 2D display coordinates (1024x646) to 3D grid centered at (0,0)
        const posX = (coords.left - 512) * 0.1;
        const posZ = (coords.top - 323) * 0.1;

        // Create extruded low-poly box for the plot
        const plotGeo = new THREE.BoxGeometry(2.1, 0.4, 2.1);
        
        // Retrieve dynamic status color
        const plotDetail = plotData.find(p => String(p.plot_no) === String(plotNo));
        const status = plotDetail ? plotDetail.plot_status : 'AVAILABLE';
        const color = window.getStatusColor ? window.getStatusColor(status) : '#10b981';

        // Glass-like translucent material
        const plotMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.65,
            shininess: 90,
            specular: 0xffffff
        });

        const plotMesh = new THREE.Mesh(plotGeo, plotMat);
        // Position on surface (y half-height = 0.2)
        plotMesh.position.set(posX, 0.2, posZ);
        plotMesh.castShadow = true;
        plotMesh.receiveShadow = true;
        plotMesh.userData = { plotNo: plotNo, baseColor: color };

        // Outlined frame
        const edges = new THREE.EdgesGeometry(plotGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.8 });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        plotMesh.add(wireframe);

        scene.add(plotMesh);
        plotMeshes.push(plotMesh);
    });
}

// Procedural Forest Generation
function generateProceduralForest() {
    // 1. Spawning border trees around the site perimeter
    const spawnPerimeterTree = (x, z) => {
        const tree = createTreeModel();
        tree.position.set(x, 0, z);
        scene.add(tree);
    };

    // Top & Bottom boundary fences
    for (let x = -50; x <= 50; x += 3.5) {
        // Add slight coordinate jitter for natural feel
        const jitterTop = (Math.random() - 0.5) * 0.8;
        const jitterBottom = (Math.random() - 0.5) * 0.8;
        spawnPerimeterTree(x + jitterTop, -31 + jitterTop);
        spawnPerimeterTree(x + jitterBottom, 31 + jitterBottom);
    }

    // Left & Right boundary fences
    for (let z = -28; z <= 28; z += 3.5) {
        const jitterLeft = (Math.random() - 0.5) * 0.8;
        const jitterRight = (Math.random() - 0.5) * 0.8;
        spawnPerimeterTree(-50 + jitterLeft, z + jitterLeft);
        spawnPerimeterTree(50 + jitterRight, z + jitterRight);
    }

    // 2. Central Park Forest Belt
    // Coordinate range corresponding to the open green park zone (left of plots 60-64)
    for (let i = 0; i < 45; i++) {
        // Random layout inside the park bounds
        const x = -18 + Math.random() * 23;
        const z = -10 + Math.random() * 20;

        // Check distance to avoid overlapping plot boxes
        let tooClose = false;
        plotMeshes.forEach(mesh => {
            const dx = mesh.position.x - x;
            const dz = mesh.position.z - z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 2.5) tooClose = true;
        });

        if (!tooClose) {
            const tree = createTreeModel(1.1 + Math.random() * 0.5); // Variable heights
            tree.position.set(x, 0, z);
            scene.add(tree);
        }
    }
}

// Procedural Tree Mesh Generator
function createTreeModel(scale = 1.0) {
    const treeGroup = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 0.8 * scale, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 }); // Brown wood
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.4 * scale;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Leaves Canopy (Layered Cones for realistic feel)
    const leafMat = new THREE.MeshLambertMaterial({ 
        color: new THREE.Color().setHSL(0.3 + Math.random() * 0.08, 0.8, 0.35 + Math.random() * 0.1), // Natural forest greens
        roughness: 0.9 
    });

    const coneGeo1 = new THREE.ConeGeometry(0.5 * scale, 1.2 * scale, 6);
    const canopy1 = new THREE.Mesh(coneGeo1, leafMat);
    canopy1.position.y = 1.2 * scale;
    canopy1.castShadow = true;
    treeGroup.add(canopy1);

    const coneGeo2 = new THREE.ConeGeometry(0.4 * scale, 0.9 * scale, 6);
    const canopy2 = new THREE.Mesh(coneGeo2, leafMat);
    canopy2.position.y = 1.7 * scale;
    canopy2.castShadow = true;
    treeGroup.add(canopy2);

    return treeGroup;
}

// Procedural Street Light Generator
function generateStreetlights() {
    // List of coordinate intersections along the main road corridors
    const lightPositions = [
        { x: 10, z: 20 },
        { x: 10, z: 5 },
        { x: 10, z: -10 },
        { x: 10, z: -25 },
        { x: -10, z: -5 },
        { x: -30, z: -5 },
        { x: 30, z: -5 },
        { x: -10, z: 15 },
        { x: -30, z: 15 },
        { x: 30, z: 15 }
    ];

    lightPositions.forEach(pos => {
        const lightPole = new THREE.Group();

        // Base pole
        const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6);
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.5, metalness: 0.8 });
        const pole = new THREE.Mesh(poleGeo, metalMat);
        pole.position.y = 1.4;
        pole.castShadow = true;
        lightPole.add(pole);

        // Arm
        const armGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6);
        const arm = new THREE.Mesh(armGeo, metalMat);
        arm.rotation.z = Math.PI / 2;
        arm.position.set(0.24, 2.7, 0);
        lightPole.add(arm);

        // Emissive light sphere
        const bulbGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // Bright yellow glow
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(0.5, 2.7, 0);
        lightPole.add(bulb);

        // Add 3D PointLight source to illuminate scene at intersections
        const pointLight = new THREE.PointLight(0xfef08a, 0.4, 8);
        pointLight.position.set(0.5, 2.6, 0);
        lightPole.add(pointLight);

        lightPole.position.set(pos.x, 0, pos.z);
        scene.add(lightPole);
    });
}

// Entrance Arch Gateway Model
function generateEntranceArch() {
    const arch = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.7 });

    // Left Pillar
    const pillarLGeo = new THREE.BoxGeometry(0.5, 3.8, 0.5);
    const pillarL = new THREE.Mesh(pillarLGeo, material);
    pillarL.position.set(-2.0, 1.9, 0);
    pillarL.castShadow = true;
    arch.add(pillarL);

    // Right Pillar
    const pillarRGeo = new THREE.BoxGeometry(0.5, 3.8, 0.5);
    const pillarR = new THREE.Mesh(pillarRGeo, material);
    pillarR.position.set(2.0, 1.9, 0);
    pillarR.castShadow = true;
    arch.add(pillarR);

    // Top Beam Arch
    const beamGeo = new THREE.BoxGeometry(4.6, 0.4, 0.6);
    const beam = new THREE.Mesh(beamGeo, material);
    beam.position.set(0, 3.9, 0);
    beam.castShadow = true;
    arch.add(beam);

    // Positioning at the main entry point on layout coordinates (X: -26.5, Z: 20)
    arch.position.set(-26.5, 0, 20);
    arch.rotation.y = -Math.PI / 12; // Angled entrance matching path drawing
    scene.add(arch);
}

// ----------------------------------------------------
// Raycaster Pointer Handlers
// ----------------------------------------------------

function onMouseMove(event) {
    if (!is3DActive || !renderer) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onMouseClick(event) {
    if (!is3DActive || !scene) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(plotMeshes);

    if (intersects.length > 0) {
        const plotNo = intersects[0].object.userData.plotNo;
        if (window.openPlotModal) {
            window.openPlotModal(plotNo);
        }
    }
}

// ----------------------------------------------------
// Animation Loop
// ----------------------------------------------------

function startRendering() {
    if (animationFrameId) return;
    
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        
        // Update controls
        if (controls) controls.update();

        // Update raycasting hover highlight
        if (is3DActive && camera) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(plotMeshes);

            if (intersects.length > 0) {
                document.body.style.cursor = 'pointer';
                const hitMesh = intersects[0].object;

                if (currentHoveredPlot !== hitMesh) {
                    resetCurrentHover();
                    currentHoveredPlot = hitMesh;
                    currentHoveredPlot.material.opacity = 0.95;
                    currentHoveredPlot.scale.set(1.05, 1.25, 1.05); // scale up slightly on hover
                }
            } else {
                document.body.style.cursor = 'default';
                resetCurrentHover();
            }
        }

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    };
    animate();
}

function stopRendering() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    resetCurrentHover();
    document.body.style.cursor = 'default';
}

function resetCurrentHover() {
    if (currentHoveredPlot) {
        currentHoveredPlot.material.opacity = 0.65;
        currentHoveredPlot.scale.set(1, 1, 1);
        currentHoveredPlot = null;
    }
}

// Window resizing
function onWindowResize() {
    const container = document.getElementById('threeCanvasContainer');
    if (!container || !renderer || !camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}
