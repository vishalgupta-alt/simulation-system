# Tactical Simulation Dashboard (with GeoTIFF Georeferencing)

A self-contained tactical command and control simulation system featuring interactive route plotting, fuel depletion curves comparison, Catmull-Rom cubic Bezier search zones deformation, and georeferenced coordinates translation using GeoTIFF metadata.

---

## 🚀 Key Features
1. **Interactive Route Plotting**: Double-click or click to add waypoints, plot paths, define speeds (knots), and select start times.
2. **Simulation Controls**: Play, pause, reset, step-forward, step-backward, time-based (seconds/minutes), or event-based stepping.
3. **Cubic Bezier Search Zones**: Deploy reshapable ellipses represented by 8 control points, featuring smooth neighbor handle falloff deformation and direct map deletion.
4. **Fuel Depletion Curves & Live Fuel Tracking**: Compares fuel usage over the simulation timeline across all plans. Auto-pauses simulation at timeline completion.
5. **GeoTIFF Integration**: Parses a 666MB global GeoTIFF map (`NE2_HR_LC_SR_W_DR.tif`) on startup to extract coordinate translation mappings, displaying precise GPS coordinates in real-time under the cursor, waypoint tooltips, and timeline listings. Automatically falls back to standard WGS84 coordinates if the TIFF is not supplied.

---

## 🛠️ Prerequisites & Setup Guide

Before running the application, ensure you have the following dependencies configured on your target system:

### 1. Java & Database Setup
1. **Java Development Kit (JDK) 17** (or higher) installed on your system.
2. **PostgreSQL** installed and running on port `5432`.
3. **PostgreSQL Database**: Create an empty database named `simulation_db` (default credentials used by the app are username `postgres` and password `postgres`).

### 2. GeoServer & GeoTIFF Map Setup
The application renders global map tiles by calling local GeoServer WMS endpoints.
1. **Download & Install GeoServer**:
   - Download the latest stable version of GeoServer (e.g. 2.24.x) from the [official downloads page](https://geoserver.org/download/).
   - Install and launch GeoServer. Ensure it runs on the default **port `8080`**.
2. **Configure WMS Layer in GeoServer**:
   - Open a browser and access the GeoServer Web Admin console at `http://localhost:8080/geoserver/web/`.
   - Log in using default credentials (Username: `admin` / Password: `geoserver`).
   - **Create a Workspace**:
     - Go to **Workspaces** (left menu) -> **Add new workspace**.
     - Set **Name** to `vishal` and **Namespace URI** to `http://localhost:8080/geoserver/vishal`.
     - Check the **Default Workspace** box and click **Save**.
   - **Add the GeoTIFF Data Store**:
     - Go to **Stores** -> **Add new Store** -> select **GeoTIFF** under Raster Data Sources.
     - Set **Workspace** to `vishal` and **Data Source Name** to `NE2_HR_LC_SR_W_DR`.
     - Click **Browse** next to Connection Parameters and select the raster TIFF map file (`NE2_HR_LC_SR_W_DR.tif`) on your local drive.
     - Click **Save**.
   - **Publish the Raster Layer**:
     - On the next screen, click **Publish** next to `NE2_HR_LC_SR_W_DR`.
     - Under the **Data** tab, verify **Declared SRS** is set to `EPSG:4326`.
     - Under **Bounding Boxes**, click **Compute from data** and then **Compute from native bounds**.
     - Click **Save**.
3. **Verify WMS Tile Delivery**:
   - Go to **Layer Preview** in the left menu.
   - Click the **OpenLayers** link next to `vishal:NE2_HR_LC_SR_W_DR` to verify the world map loads correctly in your browser.

---

## 🏃 How to Run the Application (Standalone JAR)

This project is packaged as a single, self-contained executable JAR containing both the backend and compiled frontend.

### Step 1: Start PostgreSQL
Ensure your local PostgreSQL instance is running and has the `simulation_db` database created.

### Step 2: Run the Executable
From the root of the project (`simulation-system`), execute:

```powershell
java -jar backend/target/simulation-backend-1.0.0.jar
```

*Note: If your local PostgreSQL database has a different username, password, or port, you can override them directly at runtime without rebuilding:*
```powershell
java -jar backend/target/simulation-backend-1.0.0.jar --spring.datasource.url=jdbc:postgresql://localhost:5432/YOUR_DB_NAME --spring.datasource.username=YOUR_USER --spring.datasource.password=YOUR_PASSWORD
```

### Step 3: Access the App
Open your browser and navigate to:
👉 **[http://localhost:8082/](http://localhost:8082/)**

---

## 💻 How to Run in Development Mode

If you wish to modify the source code and run servers with hot-reloading:

### 1. Start Spring Boot Backend
1. Open a terminal in the `backend/` directory.
2. Run:
   ```powershell
   # Assumes Maven is configured in your system path
   mvn spring-boot:run
   ```
   *The backend will run on port `8082`.*

### 2. Start Angular Frontend
1. Open a terminal in the `frontend/` directory.
2. Run:
   ```powershell
   npm install
   npm run start
   ```
   *The frontend dev server will start on port `4200`.*
3. Open **[http://localhost:4200/](http://localhost:4200/)** in your browser.

---

## 📦 How to Rebuild and Package the JAR

If you make modifications to the codebase and need to build a new standalone `.jar` package:

### Step 1: Build the Angular Frontend
1. Navigate to `frontend/`.
2. Compile production bundle:
   ```powershell
   npm run build
   ```

### Step 2: Copy Frontend Assets to Spring Boot
Move the compiled frontend assets from `frontend/dist/frontend/browser/` to the backend static resource directory. 
*(PowerShell command from root `simulation-system/`):*
```powershell
Remove-Item -Path "backend/src/main/resources/static/*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend/dist/frontend/browser/*" -Destination "backend/src/main/resources/static" -Recurse -Force
```

### Step 3: Package the Backend JAR
From the root directory, compile and package the JAR using Maven:
```powershell
mvn -f backend/pom.xml clean package
```
*The new executable JAR will be generated at:*  
`backend/target/simulation-backend-1.0.0.jar`
