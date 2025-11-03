import * as THREE from "three";
import type { Map as MapboxMap } from "mapbox-gl";
import mapboxgl from "mapbox-gl";

interface BusFeature {
  type: "Feature";
  id: string | number;
  properties: {
    vehicleId: number;
    name: string;
    rotation: [number, number, number];
    scale: [number, number, number];
    translation: [number, number, number];
    color: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

interface BusGeoJSON {
  type: "FeatureCollection";
  features: BusFeature[];
}

interface BusInstance {
  mesh: THREE.Group;
  lng: number;
  lat: number;
  heading: number;
}

/**
 * Create a simple 3D bus model using Three.js primitives
 */
function createBusModel(color: string): THREE.Group {
  const busGroup = new THREE.Group();

  // Create materials
  const busMaterial = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.3,
    roughness: 0.7,
  });

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x87ceeb,
    metalness: 0.8,
    roughness: 0.2,
    opacity: 0.6,
    transparent: true,
  });

  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.5,
    roughness: 0.8,
  });

  // Main bus body (elongated box)
  const bodyGeometry = new THREE.BoxGeometry(2, 1, 0.8);
  const body = new THREE.Mesh(bodyGeometry, busMaterial);
  body.position.y = 0.4;
  busGroup.add(body);

  // Front section (slightly wider for windshield area)
  const frontGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.8);
  const front = new THREE.Mesh(frontGeometry, busMaterial);
  front.position.set(1.15, 0.4, 0);
  busGroup.add(front);

  // Windows on sides
  const windowGeometry = new THREE.BoxGeometry(1.6, 0.5, 0.02);

  // Left windows
  const windowLeft = new THREE.Mesh(windowGeometry, windowMaterial);
  windowLeft.position.set(0, 0.6, 0.41);
  busGroup.add(windowLeft);

  // Right windows
  const windowRight = new THREE.Mesh(windowGeometry, windowMaterial);
  windowRight.position.set(0, 0.6, -0.41);
  busGroup.add(windowRight);

  // Front windshield
  const windshieldGeometry = new THREE.BoxGeometry(0.02, 0.5, 0.6);
  const windshield = new THREE.Mesh(windshieldGeometry, windowMaterial);
  windshield.position.set(1.05, 0.5, 0);
  busGroup.add(windshield);

  // Wheels
  const wheelGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
  wheelGeometry.rotateZ(Math.PI / 2);

  // Front left wheel
  const wheelFL = new THREE.Mesh(wheelGeometry, wheelMaterial);
  wheelFL.position.set(0.7, 0.15, 0.45);
  busGroup.add(wheelFL);

  // Front right wheel
  const wheelFR = new THREE.Mesh(wheelGeometry, wheelMaterial);
  wheelFR.position.set(0.7, 0.15, -0.45);
  busGroup.add(wheelFR);

  // Rear left wheel
  const wheelRL = new THREE.Mesh(wheelGeometry, wheelMaterial);
  wheelRL.position.set(-0.7, 0.15, 0.45);
  busGroup.add(wheelRL);

  // Rear right wheel
  const wheelRR = new THREE.Mesh(wheelGeometry, wheelMaterial);
  wheelRR.position.set(-0.7, 0.15, -0.45);
  busGroup.add(wheelRR);

  return busGroup;
}

/**
 * Creates a custom Mapbox layer that renders 3D bus models using Three.js
 */
export function createBus3DLayer(layerId: string, _modelUrl: string) {
  let camera: THREE.Camera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer;
  let map: MapboxMap;
  const busInstances: Map<string | number, BusInstance> = new Map();

  const customLayer: mapboxgl.CustomLayerInterface = {
    id: layerId,
    type: "custom",
    renderingMode: "3d",

    onAdd: function (mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      console.log("Bus 3D layer onAdd called");
      map = mapInstance;

      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // Add lights
      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
      directionalLight1.position.set(1, 1, 1).normalize();
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
      directionalLight2.position.set(-1, -1, -1).normalize();
      scene.add(directionalLight2);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      // Use the Mapbox GL JS map canvas for three.js
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });

      renderer.autoClear = false;
      console.log("Bus 3D layer setup complete - using custom bus models");
    },

    render: function (gl: WebGLRenderingContext, matrix: number[]) {
      // Get current GeoJSON data from the source
      const source = map.getSource(layerId + "-source");
      if (!source || source.type !== "geojson") {
        return;
      }

      // Access the internal _data property (Mapbox doesn't expose it publicly)
      const data = (source as any)._data as BusGeoJSON | undefined;
      if (!data || !data.features) {
        return;
      }

      // Track which bus IDs are in the current data
      const currentBusIds = new Set<string | number>();

      // Update or create bus instances for each feature
      data.features.forEach((feature) => {
        const busId = feature.id ?? feature.properties.vehicleId;
        currentBusIds.add(busId);

        const [lng, lat] = feature.geometry.coordinates;
        const heading = feature.properties.rotation[2]; // Z-axis rotation (heading)
        const color = feature.properties.color;

        let busInstance = busInstances.get(busId);

        if (!busInstance) {
          // Create a new bus model
          const mesh = createBusModel(color);
          scene.add(mesh);

          busInstance = {
            mesh,
            lng,
            lat,
            heading,
          };
          busInstances.set(busId, busInstance);

          console.log(`Created bus instance ${busId} at [${lng}, ${lat}]`);
        } else {
          // Update position and color
          busInstance.lng = lng;
          busInstance.lat = lat;
          busInstance.heading = heading;

          // Update color
          const threeColor = new THREE.Color(color);
          busInstance.mesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (mesh.material instanceof THREE.MeshStandardMaterial) {
                // Only update if not a window or wheel
                if (mesh.material.color.getHex() !== 0x87ceeb && mesh.material.color.getHex() !== 0x333333) {
                  mesh.material.color = threeColor;
                }
              }
            }
          });
        }
      });

      // Remove buses that are no longer in the data
      for (const [busId, busInstance] of busInstances.entries()) {
        if (!currentBusIds.has(busId)) {
          scene.remove(busInstance.mesh);
          busInstances.delete(busId);
          console.log(`Removed bus instance ${busId}`);
        }
      }

      // Position all bus instances
      busInstances.forEach((busInstance) => {
        const { mesh, lng, lat, heading } = busInstance;

        // Convert lat/lng to Mercator coordinates with altitude
        const altitude = 5; // 5 meters above ground to ensure visibility
        const mercatorCoord = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], altitude);
        const scale = mercatorCoord.meterInMercatorCoordinateUnits();

        // Position the mesh
        mesh.position.x = mercatorCoord.x;
        mesh.position.y = mercatorCoord.y;
        mesh.position.z = mercatorCoord.z ?? 0;

        // Scale the mesh (make it MUCH larger to ensure visibility)
        const modelScale = 500 * scale; // 50 meters - should be very visible
        mesh.scale.set(modelScale, modelScale, modelScale);

        // Rotate to face the heading direction
        // Reset rotation first
        mesh.rotation.set(Math.PI / 2, 0, 0); // Initial rotation to orient model correctly
        mesh.rotateZ((heading * Math.PI) / 180); // Apply heading rotation
      });

      // Set up the transformation matrix
      const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), 0);
      const rotationY = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), 0);
      const rotationZ = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 0, 1), 0);

      const m = new THREE.Matrix4().fromArray(matrix);
      const l = new THREE.Matrix4()
        .makeTranslation(0, 0, 0)
        .scale(new THREE.Vector3(1, -1, 1))
        .multiply(rotationX)
        .multiply(rotationY)
        .multiply(rotationZ);

      camera.projectionMatrix = m.multiply(l);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },

    onRemove: function () {
      // Clean up
      busInstances.forEach((busInstance) => {
        scene.remove(busInstance.mesh);
      });
      busInstances.clear();
    },
  };

  return customLayer;
}
