/*
   ====================================================
   Avatar 2 Digital Layout - 3D Vector Masterplan (CesiumJS)
   ====================================================
*/

let viewer = null;
let isCesiumActive = false;

// Project Site GIS Bounds (Exact Aspirealty Avatar 2 location: 16.92328 N, 78.53235 E)
const siteBounds = {
    west: 78.53050,
    south: 16.92180,
    east: 78.53420,
    north: 16.92470
};

// Suppress Cesium error popup panel globally
if (typeof Cesium !== 'undefined') {
    Cesium.showErrorPanel = function () {};
}

document.addEventListener('DOMContentLoaded', () => {
    setupCesiumControls();
});

function setupCesiumControls() {
    const toggleBtn = document.getElementById('toggleCesiumBtn');
    const cesiumContainer = document.getElementById('cesiumContainer');
    const mapContainer = document.getElementById('mapContainer');
    const mapTip = document.getElementById('mapTip');

    if (!toggleBtn || !cesiumContainer || !mapContainer) return;

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isCesiumActive = !isCesiumActive;

        if (isCesiumActive) {
            toggleBtn.classList.add('active');
            toggleBtn.title = "View 2D Layout Mode";
            toggleBtn.innerHTML = '<i class="fa-solid fa-map"></i>';

            mapContainer.style.opacity = '0';
            mapContainer.style.pointerEvents = 'none';
            cesiumContainer.style.display = 'block';

            if (mapTip) {
                mapTip.innerHTML = '<i class="fa-solid fa-earth-americas"></i> Drag to Orbit &bull; Scroll to Zoom &bull; Click Plot to View Details';
            }

            if (!viewer) {
                initCesiumViewer();
            }
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.title = "View Cesium 3D Globe";
            toggleBtn.innerHTML = '<i class="fa-solid fa-earth-americas"></i>';

            cesiumContainer.style.display = 'none';
            mapContainer.style.opacity = '1';
            mapContainer.style.pointerEvents = 'auto';

            if (mapTip) {
                mapTip.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Drag to Pan &bull; Scroll or Pinch to Zoom';
            }
        }
    });
}

function initCesiumViewer() {
    if (typeof Cesium === 'undefined') {
        console.error('CesiumJS library not loaded.');
        return;
    }

    // Disable Cesium error panel
    Cesium.showErrorPanel = function () {};

    // Disable Cesium Ion token requirement
    Cesium.Ion.defaultAccessToken = '';

    // Initialize Cesium Viewer with open ESRI Satellite Imagery
    viewer = new Cesium.Viewer('cesiumContainer', {
        imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            credit: 'Esri World Imagery'
        }),
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: true,
        sceneModePicker: true,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        selectionIndicator: true,
        infoBox: false
    });

    // Camera fly to location
    const centerLng = (siteBounds.west + siteBounds.east) / 2;
    const centerLat = (siteBounds.south + siteBounds.north) / 2;

    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat - 0.0018, 380),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0.0
        }
    });

    // Suppress render errors
    viewer.scene.renderError.addEventListener((scene, error) => {
        console.warn('Cesium render event suppressed:', error);
    });

    // Build 3D Vector Layout Masterplan Components
    buildGreenPerimeterField();
    buildRoadNetwork();
    generateVectorPlots();
    buildCurbTrees();

    // Click Selector Handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.plotNo) {
            const plotNo = pickedObject.id.plotNo;
            if (window.openPlotModal) {
                window.openPlotModal(plotNo);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// ----------------------------------------------------
// 1. Green Perimeter Landscape Polygon
// ----------------------------------------------------

function buildGreenPerimeterField() {
    const fieldRectangle = Cesium.Rectangle.fromDegrees(
        siteBounds.west - 0.0003,
        siteBounds.south - 0.0003,
        siteBounds.east + 0.0003,
        siteBounds.north + 0.0003
    );

    viewer.entities.add({
        name: "Layout Landscape Perimeter",
        rectangle: {
            coordinates: fieldRectangle,
            material: Cesium.Color.fromCssColorString('#2d5a27').withAlpha(0.92),
            height: 0
        }
    });
}

// ----------------------------------------------------
// 2. Asphalt Road Network with Street Width Text
// ----------------------------------------------------

function buildRoadNetwork() {
    const centerLng = (siteBounds.west + siteBounds.east) / 2;
    const centerLat = (siteBounds.south + siteBounds.north) / 2;

    // Main East-West Road Corridors
    const road1 = Cesium.Rectangle.fromDegrees(
        siteBounds.west,
        centerLat - 0.00015,
        siteBounds.east,
        centerLat + 0.00015
    );

    const road2 = Cesium.Rectangle.fromDegrees(
        siteBounds.west,
        centerLat + 0.0008,
        siteBounds.east,
        centerLat + 0.0011
    );

    const road3 = Cesium.Rectangle.fromDegrees(
        siteBounds.west,
        centerLat - 0.0009,
        siteBounds.east,
        centerLat - 0.0006
    );

    // North-South Connecting Road Corridors
    const roadNS = Cesium.Rectangle.fromDegrees(
        centerLng + 0.0001,
        siteBounds.south,
        centerLng + 0.0003,
        siteBounds.north
    );

    const roadColor = Cesium.Color.fromCssColorString('#1f2937'); // Asphalt dark grey

    [road1, road2, road3, roadNS].forEach((roadRect, idx) => {
        viewer.entities.add({
            name: `Road Segment ${idx + 1}`,
            rectangle: {
                coordinates: roadRect,
                material: roadColor,
                height: 1
            }
        });
    });

    // Add Street Width Text Labels along Roads
    viewer.entities.add({
        name: "Main Road Width Label 1",
        position: Cesium.Cartesian3.fromDegrees(centerLng - 0.0008, centerLat, 2),
        label: {
            text: "9 M WIDE ROAD",
            font: "bold 11px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE
        }
    });

    viewer.entities.add({
        name: "Main Road Width Label 2",
        position: Cesium.Cartesian3.fromDegrees(centerLng + 0.0008, centerLat, 2),
        label: {
            text: "9 M WIDE ROAD",
            font: "bold 11px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE
        }
    });
}

// ----------------------------------------------------
// 3. Color-Coded 3D Vector Plot Blocks & Ground Labels
// ----------------------------------------------------

function getVectorPlotColor(status) {
    const s = String(status).toUpperCase().trim();
    if (s === 'AVAILABLE') return { color: '#fffbe6', text: '#111827' }; // Cream Available
    if (s === 'SOLD' || s === 'BOOKED' || s === 'CLUB HOUSE') return { color: '#f59e0b', text: '#ffffff' }; // Gold Sold/Booked
    if (s === 'HOLD') return { color: '#eab308', text: '#111827' }; // Gold Hold
    if (s === 'MORTGAGE') return { color: '#f97316', text: '#ffffff' }; // Orange Mortgage
    return { color: '#fffbe6', text: '#111827' };
}

function generateVectorPlots() {
    if (typeof plotCoordinates === 'undefined' || typeof plotData === 'undefined') return;

    Object.keys(plotCoordinates).forEach(plotNo => {
        const coords = plotCoordinates[plotNo];

        // Map (left, top) 1024x646 2D coordinates to geographic (lng, lat)
        const lng = siteBounds.west + (coords.left / 1024) * (siteBounds.east - siteBounds.west);
        const lat = siteBounds.north - (coords.top / 646) * (siteBounds.north - siteBounds.south);

        const plotDetail = plotData.find(p => String(p.plot_no) === String(plotNo));
        const status = plotDetail ? plotDetail.plot_status : 'AVAILABLE';
        const colorConfig = getVectorPlotColor(status);

        // Vector rectangle bounds for each plot block
        const pWest = lng - 0.000085;
        const pEast = lng + 0.000085;
        const pSouth = lat - 0.000055;
        const pNorth = lat + 0.000055;

        const plotRectangle = Cesium.Rectangle.fromDegrees(pWest, pSouth, pEast, pNorth);

        // Create 3D Vector Tile Entity for Plot
        const entity = viewer.entities.add({
            name: `Plot ${plotNo}`,
            rectangle: {
                coordinates: plotRectangle,
                material: Cesium.Color.fromCssColorString(colorConfig.color).withAlpha(0.95),
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString('#374151'),
                height: 2,
                extrudedHeight: 3.5
            },
            label: {
                text: `${plotNo}`,
                font: 'bold 11px sans-serif',
                fillColor: Cesium.Color.fromCssColorString(colorConfig.text),
                outlineColor: colorConfig.text === '#ffffff' ? Cesium.Color.BLACK : Cesium.Color.TRANSPARENT,
                outlineWidth: 1.5,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        });

        entity.plotNo = plotNo;
    });
}

// ----------------------------------------------------
// 4. Curb Trees along Road Borders
// ----------------------------------------------------

function buildCurbTrees() {
    const centerLng = (siteBounds.west + siteBounds.east) / 2;
    const centerLat = (siteBounds.south + siteBounds.north) / 2;

    for (let x = siteBounds.west; x <= siteBounds.east; x += 0.00025) {
        // Upper road trees
        spawnCurbTree(x, centerLat + 0.00115);
        spawnCurbTree(x, centerLat + 0.00075);

        // Central road trees
        spawnCurbTree(x, centerLat + 0.00018);
        spawnCurbTree(x, centerLat - 0.00018);

        // Lower road trees
        spawnCurbTree(x, centerLat - 0.00055);
        spawnCurbTree(x, centerLat - 0.00095);
    }
}

function spawnCurbTree(lng, lat) {
    viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, 2),
        cylinder: {
            length: 4.5,
            topRadius: 0.1,
            bottomRadius: 1.8,
            material: Cesium.Color.fromCssColorString('#15803d') // Lush green tree canopy
        }
    });
}
