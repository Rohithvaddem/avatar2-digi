/*
   ====================================================
   Avatar 2 Digital Layout - CesiumJS WebGIS Controller
   ====================================================
*/

let viewer = null;
let isCesiumActive = false;

// Project Site GIS Bounds (Exact Aspirealty Avatar 2 location: 16.92328 N, 78.53235 E)
const siteBounds = {
    west: 78.53110,
    south: 16.92248,
    east: 78.53360,
    north: 16.92408
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

// Disable Cesium red alert error panel popup globally
if (typeof Cesium !== 'undefined') {
    Cesium.showErrorPanel = function () {};
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

    // Fly camera to project location
    const centerLng = (siteBounds.west + siteBounds.east) / 2;
    const centerLat = (siteBounds.south + siteBounds.north) / 2;

    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat - 0.0015, 350),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0.0
        }
    });

    // Suppress Cesium alert popup modal on WebGL rendering glitches
    viewer.scene.renderError.addEventListener((scene, error) => {
        console.warn('Cesium render event suppressed:', error);
    });

    // Add Ground Layout Overlay Image using Blob URL (prevents WebGL texImage2D SecurityError)
    const rectangle = Cesium.Rectangle.fromDegrees(
        siteBounds.west,
        siteBounds.south,
        siteBounds.east,
        siteBounds.north
    );

    fetch('map_layout.jpg')
        .then(res => res.blob())
        .then(blob => {
            const objectUrl = URL.createObjectURL(blob);
            viewer.entities.add({
                name: "Avatar 2 Project Layout Drawing",
                rectangle: {
                    coordinates: rectangle,
                    material: new Cesium.ImageMaterialProperty({
                        image: objectUrl,
                        transparent: true,
                        alpha: 0.85
                    })
                }
            });
        })
        .catch((err) => {
            console.warn('Map layout image fetch skipped:', err);
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

        // Add extruded 3D Box Entity for the Plot
        const entity = viewer.entities.add({
            name: `Plot ${plotNo}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 4),
            box: {
                dimensions: new Cesium.Cartesian3(22.0, 22.0, 8.0),
                material: color.withAlpha(0.75),
                outline: true,
                outlineColor: Cesium.Color.WHITE
            },
            label: {
                text: `${plotNo}`,
                font: 'bold 12px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -18),
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        });

        entity.plotNo = plotNo;
    });
}
