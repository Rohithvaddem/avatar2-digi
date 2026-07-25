/*
   ====================================================
   Avatar 2 Digital Layout - CesiumJS WebGIS Controller
   ====================================================
*/

let viewer = null;
let isCesiumActive = false;

// Project Site GIS Bounds (Yacharam area site coordinates)
const siteBounds = {
    west: 78.6649,
    south: 17.0275,
    east: 78.6749,
    north: 17.0347
};

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

    // Initialize Cesium Viewer
    viewer = new Cesium.Viewer('cesiumContainer', {
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: true,
        sceneModePicker: true,
        baseLayerPicker: true,
        navigationHelpButton: false,
        fullscreenButton: false,
        selectionIndicator: true,
        infoBox: false
    });

    // Fly camera to project location
    const centerLng = (siteBounds.west + siteBounds.east) / 2;
    const centerLat = (siteBounds.south + siteBounds.north) / 2;

    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat - 0.003, 1200),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0.0
        }
    });

    // Add Ground Layout Overlay Image
    const rectangle = Cesium.Rectangle.fromDegrees(
        siteBounds.west,
        siteBounds.south,
        siteBounds.east,
        siteBounds.north
    );

    viewer.entities.add({
        name: "Avatar 2 Project Layout Drawing",
        rectangle: {
            coordinates: rectangle,
            material: new Cesium.ImageMaterialProperty({
                image: 'map_layout.jpg',
                transparent: true,
                alpha: 0.85
            })
        }
    });

    // Add Plot Entities
    generateCesiumPlots();

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

function getCesiumStatusColor(status) {
    const s = String(status).toUpperCase().trim();
    if (s === 'AVAILABLE') return Cesium.Color.fromCssColorString('#10b981');
    if (s === 'SOLD' || s === 'BOOKED' || s === 'CLUB HOUSE') return Cesium.Color.fromCssColorString('#ef4444');
    if (s === 'HOLD') return Cesium.Color.fromCssColorString('#eab308');
    if (s === 'MORTGAGE') return Cesium.Color.fromCssColorString('#f97316');
    return Cesium.Color.fromCssColorString('#6b7280');
}

function generateCesiumPlots() {
    if (typeof plotCoordinates === 'undefined' || typeof plotData === 'undefined') return;

    Object.keys(plotCoordinates).forEach(plotNo => {
        const coords = plotCoordinates[plotNo];

        // Map (left, top) 1024x646 2D coordinates to geographic (lng, lat)
        const lng = siteBounds.west + (coords.left / 1024) * (siteBounds.east - siteBounds.west);
        const lat = siteBounds.north - (coords.top / 646) * (siteBounds.north - siteBounds.south);

        const plotDetail = plotData.find(p => String(p.plot_no) === String(plotNo));
        const status = plotDetail ? plotDetail.plot_status : 'AVAILABLE';
        const color = getCesiumStatusColor(status);

        // Add 3D Point & Box Entity for the Plot
        const entity = viewer.entities.add({
            name: `Plot ${plotNo}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 10),
            point: {
                pixelSize: 14,
                color: color,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            },
            label: {
                text: `${plotNo}`,
                font: '11px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -16),
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        });

        entity.plotNo = plotNo;
    });
}
