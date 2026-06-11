import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, Input, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SimulationService, SymbolState } from '../../services/simulation.service';
import { ApiService, Plan, EllipseZone, Waypoint, MapMetadata } from '../../services/api.service';
import { Chart, registerables } from 'chart.js';
import * as L from 'leaflet';
import { 
  LucideRotateCcw, 
  LucideSkipBack, 
  LucidePlay, 
  LucidePause, 
  LucideSkipForward, 
  LucideCircle,
  LucideTrash2,
  LucideMapPin,
  LucideRoute,
  LucideList
} from '@lucide/angular';

Chart.register(...registerables);

interface WaypointFuelDetail {
  name: string;
  fuelRemaining: number;
  timeOffsetMinutes: number;
  latitude?: number;
  longitude?: number;
}

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    LucideRotateCcw, 
    LucideSkipBack, 
    LucidePlay, 
    LucidePause, 
    LucideSkipForward, 
    LucideCircle,
    LucideTrash2,
    LucideMapPin,
    LucideRoute,
    LucideList
  ],
  templateUrl: './map-view.component.html',
  styles: [`
    .map-view-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      position: relative;
    }
    .map-container {
      position: relative;
      width: 100%;
      flex: 1; /* expand to fill main panel */
      background-color: #05070a;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: var(--shadow-premium);
    }
    .svg-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      cursor: crosshair;
    }
    .route-line {
      fill: none;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.4));
    }
    .waypoint-circle {
      cursor: pointer;
      transition: r 0.2s;
    }
    .waypoint-circle:hover {
      r: 6;
    }
    .symbol-g {
      cursor: pointer;
    }
    .ellipse-path {
      fill: rgba(6, 182, 212, 0.12);
      stroke: var(--color-cyan);
      stroke-width: 2;
      stroke-dasharray: 4 2;
      cursor: move;
    }
    .tooltip-card {
      position: absolute;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 12px;
      pointer-events: none;
      z-index: 100;
      font-size: 11px;
      color: var(--color-text-primary);
      box-shadow: var(--shadow-premium);
    }
    /* Floating Plan Window styling */
    .floating-plan-panel {
      position: absolute;
      top: 20px;
      left: 20px;
      width: 320px;
      max-height: calc(100% - 40px);
      z-index: 20;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
    }
    .plan-card {
      background: rgba(11, 15, 25, 0.6);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
      transition: all 0.2s;
    }
    .plan-card:hover {
      border-color: var(--color-primary);
    }
    /* Flow node connector styles */
    .flow-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 8px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .flow-node-row {
      display: flex;
      align-items: center;
      position: relative;
    }
    .flow-node-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      border: 2px solid var(--color-cyan);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 10px;
      color: #ffffff;
      box-shadow: 0 0 8px rgba(6, 182, 212, 0.25);
      z-index: 2;
    }
    .flow-node-line {
      width: 3px;
      height: 20px;
      background: var(--border-color);
      margin-left: 18px;
      z-index: 1;
    }
    .flow-node-info {
      margin-left: 12px;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class MapViewComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('svgElement') svgElement!: ElementRef<SVGElement>;
  
  @Input() activeTab: 'plan' | 'deploy' | 'charts' = 'plan';

  get showPlanWindow(): boolean {
    return this.activeTab === 'plan';
  }

  private _fuelCanvas: ElementRef<HTMLCanvasElement> | undefined;
  @ViewChild('fuelChartCanvas') set fuelChartCanvas(content: ElementRef<HTMLCanvasElement>) {
    if (content) {
      this._fuelCanvas = content;
      setTimeout(() => this.initFuelChart(), 0);
    } else {
      this._fuelCanvas = undefined;
      if (this.fuelChart) {
        this.fuelChart.destroy();
        this.fuelChart = null;
      }
    }
  }

  private _distCanvas: ElementRef<HTMLCanvasElement> | undefined;
  @ViewChild('distanceChartCanvas') set distanceChartCanvas(content: ElementRef<HTMLCanvasElement>) {
    if (content) {
      this._distCanvas = content;
      setTimeout(() => this.initDistanceChart(), 0);
    } else {
      this._distCanvas = undefined;
      if (this.distanceChart) {
        this.distanceChart.destroy();
        this.distanceChart = null;
      }
    }
  }

  plansList: Plan[] = [];
  ellipsesList: EllipseZone[] = [];
  symbolStates: SymbolState[] = [];

  // Dragging states
  draggingEllipse: EllipseZone | null = null;
  draggingHandleIndex: number = -1;
  dragStartMouseX: number = 0; // Lon
  dragStartMouseY: number = 0; // Lat
  dragStartPoints: Waypoint[] = [];

  // Plan Form properties
  newPlanName: string = '';
  newPlanSpeed: number = 15;
  newPlanStartTime: string = '2026-06-10T08:00';
  newPlanFuelLimit: number = 1000;
  newPlanFuelConsumption: number = 1.0;
  isDrawingRoute: boolean = false;
  drawingWaypoints: Waypoint[] = [];

  // Tooltips
  hoveredSymbol: SymbolState | null = null;
  hoveredEllipse: EllipseZone | null = null;
  hoveredWaypoint: Waypoint | null = null;
  hoveredWaypointPlan: Plan | null = null;
  tooltipX: number = 0;
  tooltipY: number = 0;

  // Map Metadata & Coordinates
  mapMetadata: MapMetadata | null = null;
  cursorLon: number | null = null;
  cursorLat: number | null = null;

  selectedPlan: Plan | null = null;
  selectedPlanWaypointsFuel: WaypointFuelDetail[] = [];
  fuelChart: Chart | null = null;
  distanceChart: Chart | null = null;
  simulationDuration: number = 24 * 3600;

  private map!: L.Map;

  get mapImageUrl(): string {
    return this.apiService.getMapImageUrl();
  }

  constructor(
    public simulationService: SimulationService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.simulationService.symbolStates$.subscribe(states => {
      this.symbolStates = states;
      this.projectCoordinatesToSvg();
    });

    this.simulationService.plans$.subscribe(plans => {
      this.plansList = plans;
      if (plans.length > 0) {
        if (!this.selectedPlan || !plans.some(p => p.id === this.selectedPlan?.id)) {
          this.selectedPlan = plans[0];
        } else {
          this.selectedPlan = plans.find(p => p.id === this.selectedPlan?.id) || plans[0];
        }
        this.calculateWaypointFuelDetails();
      } else {
        this.selectedPlan = null;
        this.selectedPlanWaypointsFuel = [];
      }
      this.updateCharts();
      this.projectCoordinatesToSvg();
    });

    this.simulationService.ellipses$.subscribe(ellipses => {
      this.ellipsesList = ellipses;
      this.projectCoordinatesToSvg();
    });

    this.simulationService.simulationDuration$.subscribe(duration => {
      this.simulationDuration = duration;
      this.updateCharts();
    });

    this.simulationService.currentTimeOffset$.subscribe(() => {
      if (this.activeTab === 'charts' && this.fuelChart) {
        this.fuelChart.update('none');
      }
    });

    this.loadMapMetadata();
    this.loadPlans();
    this.loadEllipses();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  ngOnDestroy() {
    this.simulationService.setPlaying(false);
    this.cancelDrawing();
    if (this.fuelChart) {
      this.fuelChart.destroy();
    }
    if (this.distanceChart) {
      this.distanceChart.destroy();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  initMap() {
    this.map = L.map('map', {
      center: [20.0, 78.0], // Center near India
      zoom: 3,
      minZoom: 1,
      maxZoom: 12,
      zoomControl: true,
      crs: L.CRS.EPSG4326
    });

    L.tileLayer.wms('http://localhost:8080/geoserver/vishal/wms', {
      layers: 'vishal:NE2_HR_LC_SR_W_DR',
      format: 'image/jpeg',
      transparent: false,
      version: '1.1.0',
      crs: L.CRS.EPSG4326,
      attribution: 'GeoServer WMS'
    }).addTo(this.map);

    this.map.on('zoomend moveend move viewreset', () => {
      this.projectCoordinatesToSvg();
    });

    setTimeout(() => {
      this.projectCoordinatesToSvg();
      this.map.invalidateSize();
    }, 200);
  }

  projectCoordinatesToSvg() {
    if (!this.map) return;

    this.plansList.forEach(plan => {
      plan.waypoints.forEach(wp => {
        if (wp.latitude !== undefined && wp.longitude !== undefined) {
          const pt = this.map.latLngToContainerPoint(L.latLng(wp.latitude, wp.longitude));
          wp.x = pt.x;
          wp.y = pt.y;
        }
      });
    });

    if (this.isDrawingRoute && this.drawingWaypoints.length > 0) {
      this.drawingWaypoints.forEach(wp => {
        if (wp.latitude !== undefined && wp.longitude !== undefined) {
          const pt = this.map.latLngToContainerPoint(L.latLng(wp.latitude, wp.longitude));
          wp.x = pt.x;
          wp.y = pt.y;
        }
      });
    }

    this.ellipsesList.forEach(ellipse => {
      ellipse.controlPoints.forEach(cp => {
        if (cp.latitude !== undefined && cp.longitude !== undefined) {
          const pt = this.map.latLngToContainerPoint(L.latLng(cp.latitude, cp.longitude));
          cp.x = pt.x;
          cp.y = pt.y;
        }
      });
      
      let sumLat = 0, sumLon = 0;
      let count = 0;
      ellipse.controlPoints.forEach(cp => {
        if (cp.latitude !== undefined && cp.longitude !== undefined) {
          sumLat += cp.latitude;
          sumLon += cp.longitude;
          count++;
        }
      });
      if (count > 0) {
        const centerLat = sumLat / count;
        const centerLon = sumLon / count;
        const pt = this.map.latLngToContainerPoint(L.latLng(centerLat, centerLon));
        ellipse.centerX = pt.x;
        ellipse.centerY = pt.y;
      }
    });

    this.symbolStates.forEach(state => {
      if (state.currentLat !== undefined && state.currentLon !== undefined) {
        const pt = this.map.latLngToContainerPoint(L.latLng(state.currentLat, state.currentLon));
        state.currentX = pt.x;
        state.currentY = pt.y;
      }
    });
  }

  loadMapMetadata() {
    this.apiService.getMapMetadata().subscribe({
      next: (meta) => {
        this.mapMetadata = meta;
      },
      error: (err) => {
        console.error('Failed to load map metadata', err);
      }
    });
  }

  loadPlans() {
    this.apiService.getPlans().subscribe(plans => {
      this.plansList = plans;
      this.simulationService.setPlans(plans);
      this.projectCoordinatesToSvg();
    });
  }

  loadEllipses() {
    this.apiService.getEllipses().subscribe(ellipses => {
      this.ellipsesList = ellipses;
      this.simulationService.setEllipses(ellipses);
      this.projectCoordinatesToSvg();
    });
  }

  startDrawing() {
    if (!this.newPlanName) {
      alert('Please enter a Plan Name first.');
      return;
    }
    this.isDrawingRoute = true;
    this.drawingWaypoints = [];
    (window as any).isDrawingMapRoute = true;
    (window as any).tempWaypoints = [];
  }

  cancelDrawing() {
    this.isDrawingRoute = false;
    this.drawingWaypoints = [];
    (window as any).isDrawingMapRoute = false;
    (window as any).tempWaypoints = [];
  }

  finishDrawingAndSave() {
    if (this.drawingWaypoints.length < 2) {
      alert('Please plot at least 2 waypoints on the map.');
      return;
    }

    const plan: Plan = {
      name: this.newPlanName,
      speed: this.newPlanSpeed,
      startTime: new Date(this.newPlanStartTime).toISOString(),
      waypoints: [...this.drawingWaypoints],
      fuelLimit: this.newPlanFuelLimit,
      fuelConsumption: this.newPlanFuelConsumption
    };

    this.apiService.createPlan(plan).subscribe({
      next: () => {
        this.loadPlans();
        this.newPlanName = '';
        this.newPlanSpeed = 15;
        this.newPlanFuelLimit = 1000;
        this.newPlanFuelConsumption = 1.0;
        this.cancelDrawing();
      },
      error: (err) => {
        console.error('Failed to create plan', err);
        alert('Error saving plan to backend');
      }
    });
  }

  deletePlan(id?: string, event?: Event) {
    if (event) event.stopPropagation();
    if (!id) return;
    if (confirm('Are you sure you want to delete this plan?')) {
      this.apiService.deletePlan(id).subscribe(() => {
        this.loadPlans();
      });
    }
  }

  onMapClick(event: MouseEvent) {
    if (this.isDrawingRoute && (window as any).isDrawingMapRoute && this.map) {
      const latlng = this.map.mouseEventToLatLng(event);
      const latitude = Math.round(latlng.lat * 10000) / 10000;
      const longitude = Math.round(latlng.lng * 10000) / 10000;
      
      const point = this.map.latLngToContainerPoint(latlng);
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      
      const wp: Waypoint = { 
        x, 
        y, 
        name: `WP ${this.drawingWaypoints.length + 1}`,
        latitude,
        longitude
      };
      this.drawingWaypoints.push(wp);
      
      (window as any).tempWaypoints = this.drawingWaypoints;
    }
  }

  onSvgMouseMove(event: MouseEvent) {
    if (!this.map) return;
    try {
      const latlng = this.map.mouseEventToLatLng(event);
      this.cursorLon = latlng.lng;
      this.cursorLat = latlng.lat;
    } catch (e) {
      // In case element is not fully loaded
    }
  }

  onSvgMouseLeave() {
    this.cursorLon = null;
    this.cursorLat = null;
  }

  formatGeoCoords(lat?: number, lon?: number): string {
    if (lat === undefined || lon === undefined || lat === null || lon === null) return '';
    const latDirection = lat >= 0 ? 'N' : 'S';
    const lonDirection = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDirection}, ${Math.abs(lon).toFixed(4)}° ${lonDirection}`;
  }

  get isDrawingActive(): boolean {
    return this.isDrawingRoute;
  }

  deployNewEllipse() {
    if (!this.map) return;
    const center = this.map.getCenter();
    const centerLat = center.lat;
    const centerLon = center.lng;
    
    // Increased size to match original pixel-relative size (~90px by ~60px at default zoom 3)
    const rxDeg = 15.0;
    const ryDeg = 10.0;
    
    const offsets = [
      { x: rxDeg, y: 0 },                    // P0 (Right Anchor)
      { x: rxDeg * 0.9, y: ryDeg * 0.9 },    // P1 (Control Handle 1)
      { x: 0, y: ryDeg },                    // P2 (Bottom Anchor / North)
      { x: -rxDeg * 0.9, y: ryDeg * 0.9 },   // P3 (Control Handle 2)
      { x: -rxDeg, y: 0 },                   // P4 (Left Anchor)
      { x: -rxDeg * 0.9, y: -ryDeg * 0.9 },  // P5 (Control Handle 3)
      { x: 0, y: -ryDeg },                   // P6 (Top Anchor / South)
      { x: rxDeg * 0.9, y: -ryDeg * 0.9 }    // P7 (Control Handle 4)
    ];

    const controlPoints: Waypoint[] = offsets.map((offset, idx) => {
      const lon = centerLon + offset.x;
      const lat = centerLat + offset.y;
      return {
        x: 0,
        y: 0,
        name: `P${idx}`,
        latitude: Math.round(lat * 10000) / 10000,
        longitude: Math.round(lon * 10000) / 10000
      };
    });

    const newEllipse: EllipseZone = {
      name: `Search Area ${this.ellipsesList.length + 1}`,
      centerX: centerLon,
      centerY: centerLat,
      radiusX: rxDeg,
      radiusY: ryDeg,
      rotation: 0,
      controlPoints: controlPoints
    };

    this.apiService.createEllipse(newEllipse).subscribe(() => {
      this.loadEllipses();
    });
  }

  deleteEllipse(id?: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (!id) return;
    if (confirm('Delete this Search Area/Ellipse?')) {
      this.apiService.deleteEllipse(id).subscribe(() => {
        this.loadEllipses();
        this.hoveredEllipse = null;
      });
    }
  }

  startDragEllipse(ellipse: EllipseZone, handleIndex: number, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    if (!this.map) return;

    this.draggingEllipse = ellipse;
    this.draggingHandleIndex = handleIndex;
    
    const latlng = this.map.mouseEventToLatLng(event);
    this.dragStartMouseX = latlng.lng;
    this.dragStartMouseY = latlng.lat;

    this.dragStartPoints = ellipse.controlPoints.map(p => ({ ...p }));
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.draggingEllipse || !this.map) return;

    try {
      const latlng = this.map.mouseEventToLatLng(event);
      const currentMouseLon = latlng.lng;
      const currentMouseLat = latlng.lat;

      const dx = currentMouseLon - this.dragStartMouseX;
      const dy = currentMouseLat - this.dragStartMouseY;

      if (this.draggingHandleIndex === -1) {
        for (let i = 0; i < this.draggingEllipse.controlPoints.length; i++) {
          const cp = this.draggingEllipse.controlPoints[i];
          const startCp = this.dragStartPoints[i];
          if (cp.latitude !== undefined && cp.longitude !== undefined && startCp.latitude !== undefined && startCp.longitude !== undefined) {
            cp.longitude = startCp.longitude + dx;
            cp.latitude = startCp.latitude + dy;
          }
        }
      } else {
        const idx = this.draggingHandleIndex;
        
        const applyDelta = (ptIdx: number, factor: number) => {
          const cp = this.draggingEllipse!.controlPoints[ptIdx];
          const startCp = this.dragStartPoints[ptIdx];
          if (cp.latitude !== undefined && cp.longitude !== undefined && startCp.latitude !== undefined && startCp.longitude !== undefined) {
            cp.longitude = startCp.longitude + dx * factor;
            cp.latitude = startCp.latitude + dy * factor;
          }
        };

        applyDelta(idx, 1.0);

        const prev1 = (idx - 1 + 8) % 8;
        const next1 = (idx + 1) % 8;
        applyDelta(prev1, 0.5);
        applyDelta(next1, 0.5);

        const prev2 = (idx - 2 + 8) % 8;
        const next2 = (idx + 2) % 8;
        applyDelta(prev2, 0.2);
        applyDelta(next2, 0.2);
      }

      // Recalculate radius approximations in degrees for tooltips
      const pts = this.draggingEllipse.controlPoints;
      if (pts[0].longitude !== undefined && pts[4].longitude !== undefined && pts[0].latitude !== undefined && pts[4].latitude !== undefined) {
        const dLon = pts[0].longitude - pts[4].longitude;
        const dLat = pts[0].latitude - pts[4].latitude;
        this.draggingEllipse.radiusX = Math.round((Math.sqrt(dLon * dLon + dLat * dLat) / 2) * 10) / 10;
      }
      if (pts[2].longitude !== undefined && pts[6].longitude !== undefined && pts[2].latitude !== undefined && pts[6].latitude !== undefined) {
        const dLon = pts[2].longitude - pts[6].longitude;
        const dLat = pts[2].latitude - pts[6].latitude;
        this.draggingEllipse.radiusY = Math.round((Math.sqrt(dLon * dLon + dLat * dLat) / 2) * 10) / 10;
      }

      this.projectCoordinatesToSvg();
    } catch (e) {
      // Catch out of bounds mouse movements
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.draggingEllipse && this.draggingEllipse.id) {
      this.apiService.updateEllipse(this.draggingEllipse.id, this.draggingEllipse).subscribe(() => {
        this.loadEllipses();
      });
    }
    this.draggingEllipse = null;
    this.draggingHandleIndex = -1;
  }

  getEllipseBezierPath(ellipse: EllipseZone): string {
    const pts = ellipse.controlPoints;
    if (!pts || pts.length < 8) return '';
    return `M ${pts[0].x} ${pts[0].y} ` +
           `Q ${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y} ` +
           `Q ${pts[3].x} ${pts[3].y} ${pts[4].x} ${pts[4].y} ` +
           `Q ${pts[5].x} ${pts[5].y} ${pts[6].x} ${pts[6].y} ` +
           `Q ${pts[7].x} ${pts[7].y} ${pts[0].x} ${pts[0].y} Z`;
  }

  getRoutePointsString(plan: Plan): string {
    return plan.waypoints.map(w => `${w.x},${w.y}`).join(' ');
  }

  getColors(idx: number): string {
    const colors = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#06b6d4', '#ec4899'];
    return colors[idx % colors.length];
  }

  getSymbolGeoCoords(state: SymbolState): string {
    if (state.currentLat === undefined || state.currentLon === undefined) return '';
    return this.formatGeoCoords(state.currentLat, state.currentLon);
  }

  showSymbolTooltip(state: SymbolState, event: MouseEvent) {
    this.hoveredSymbol = state;
    const rect = this.svgElement.nativeElement.getBoundingClientRect();
    this.tooltipX = event.clientX - rect.left + 15;
    this.tooltipY = event.clientY - rect.top + 15;
  }

  hideSymbolTooltip() {
    this.hoveredSymbol = null;
  }

  showEllipseTooltip(ellipse: EllipseZone, event: MouseEvent) {
    this.hoveredEllipse = ellipse;
    const rect = this.svgElement.nativeElement.getBoundingClientRect();
    this.tooltipX = event.clientX - rect.left + 15;
    this.tooltipY = event.clientY - rect.top + 15;
  }

  hideEllipseTooltip() {
    this.hoveredEllipse = null;
  }

  showWaypointTooltip(wp: Waypoint, plan: Plan, event: MouseEvent) {
    this.hoveredWaypoint = wp;
    this.hoveredWaypointPlan = plan;
    const rect = this.svgElement.nativeElement.getBoundingClientRect();
    this.tooltipX = event.clientX - rect.left + 15;
    this.tooltipY = event.clientY - rect.top + 15;
  }

  hideWaypointTooltip() {
    this.hoveredWaypoint = null;
    this.hoveredWaypointPlan = null;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString();
  }

  calculateWaypointFuelDetails() {
    if (!this.selectedPlan) {
      this.selectedPlanWaypointsFuel = [];
      return;
    }
    
    const plan = this.selectedPlan;
    const wps = plan.waypoints || [];
    if (wps.length === 0) {
      this.selectedPlanWaypointsFuel = [];
      return;
    }

    const details: WaypointFuelDetail[] = [];
    const fuelLimit = plan.fuelLimit || 1000.0;
    const fuelConsumption = plan.fuelConsumption || 1.0;
    const fuelConsumptionPerSec = fuelConsumption / 60.0;
    
    let cumulativeDist = 0;
    
    const getLon = (wp: Waypoint) => {
      if (wp.longitude !== undefined && wp.longitude !== null) return wp.longitude;
      return -180.0 + (wp.x / 1000) * 360.0;
    };

    const getLat = (wp: Waypoint) => {
      if (wp.latitude !== undefined && wp.latitude !== null) return wp.latitude;
      return 90.0 - (wp.y / 1000) * 180.0;
    };
    
    details.push({
      name: wps[0].name || 'WP 1',
      fuelRemaining: fuelLimit,
      timeOffsetMinutes: 0,
      latitude: getLat(wps[0]),
      longitude: getLon(wps[0])
    });

    for (let i = 1; i < wps.length; i++) {
      const p1 = wps[i - 1];
      const p2 = wps[i];
      
      const dLon = getLon(p2) - getLon(p1);
      const dLat = getLat(p2) - getLat(p1);
      const dist = Math.sqrt(dLon * dLon + dLat * dLat);
      cumulativeDist += dist;

      const speedInDegSec = plan.speed / 216000.0;
      const timeToReachSeconds = speedInDegSec > 0 ? cumulativeDist / speedInDegSec : 0;
      const fuelUsed = timeToReachSeconds * fuelConsumptionPerSec;
      const fuelRemaining = Math.max(0, fuelLimit - fuelUsed);

      details.push({
        name: p2.name || `WP ${i + 1}`,
        fuelRemaining: Math.round(fuelRemaining * 10) / 10,
        timeOffsetMinutes: Math.round((timeToReachSeconds / 60) * 10) / 10,
        latitude: getLat(p2),
        longitude: getLon(p2)
      });
    }

    this.selectedPlanWaypointsFuel = details;
  }

  onPlanSelectChange() {
    this.calculateWaypointFuelDetails();
  }

  initFuelChart() {
    if (this.fuelChart) {
      this.fuelChart.destroy();
    }
    if (!this._fuelCanvas) return;
    const ctx = this._fuelCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const timeIndicatorPlugin = {
      id: 'timeIndicator',
      afterDraw: (chart: any) => {
        if (this.activeTab !== 'charts') return;

        const offset = this.simulationService.getCurrentTimeOffset();
        const duration = this.simulationDuration;
        if (duration <= 0) return;

        const percentage = offset / duration;
        const ctx2 = chart.ctx;
        const xAxis = chart.scales ? chart.scales.x : null;
        const yAxis = chart.scales ? chart.scales.y : null;
        if (!xAxis || !yAxis || xAxis.left === undefined || xAxis.width === undefined) return;

        const xPos = xAxis.left + percentage * xAxis.width;

        ctx2.save();
        ctx2.beginPath();
        ctx2.moveTo(xPos, yAxis.top);
        ctx2.lineTo(xPos, yAxis.bottom);
        ctx2.lineWidth = 1.5;
        ctx2.strokeStyle = '#ef4444';
        ctx2.setLineDash([4, 4]);
        ctx2.stroke();
        ctx2.restore();
      }
    };

    this.fuelChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#f8fafc', font: { family: 'Outfit', size: 9 } }
          },
          title: {
            display: false
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.03)' },
            ticks: { color: '#94a3b8', font: { size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.03)' },
            ticks: { color: '#94a3b8', font: { size: 9 } },
            min: 0
          }
        }
      },
      plugins: [timeIndicatorPlugin]
    });
    this.updateCharts();
  }

  initDistanceChart() {
    if (this.distanceChart) {
      this.distanceChart.destroy();
    }
    if (!this._distCanvas) return;
    const ctx = this._distCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.distanceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: false
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.03)' },
            ticks: { color: '#94a3b8', font: { size: 9 } }
          }
        }
      }
    });
    this.updateCharts();
  }

  updateCharts() {
    if (!this.fuelChart || !this.distanceChart || this.plansList.length === 0) return;

    const duration = this.simulationDuration;
    const intervals = 10;
    const step = duration / intervals;
    const labels: string[] = [];
    const timePoints: number[] = [];

    for (let i = 0; i <= intervals; i++) {
      const sec = Math.round(i * step);
      timePoints.push(sec);
      
      if (duration < 3600) {
        labels.push(`${Math.round(sec / 60)}m`);
      } else {
        const hrs = Math.round((sec / 3600) * 10) / 10;
        labels.push(`${hrs}h`);
      }
    }

    const fuelDatasets = this.plansList.map((plan, idx) => {
      const color = this.getColors(idx);
      const data = timePoints.map(simSeconds => {
        const planStart = new Date(plan.startTime);
        const gameStart = this.simulationService.getGameStartDate();
        const planStartOffset = (planStart.getTime() - gameStart.getTime()) / 1000;

        if (simSeconds < planStartOffset) {
          return 1000.0;
        }

        const timeMoving = simSeconds - planStartOffset;
        
        let totalPathLength = 0;
        const waypoints = plan.waypoints || [];
        
        const getLon = (wp: Waypoint) => {
          if (wp.longitude !== undefined && wp.longitude !== null) return wp.longitude;
          return -180.0 + (wp.x / 1000) * 360.0;
        };

        const getLat = (wp: Waypoint) => {
          if (wp.latitude !== undefined && wp.latitude !== null) return wp.latitude;
          return 90.0 - (wp.y / 1000) * 180.0;
        };

        for (let i = 0; i < waypoints.length - 1; i++) {
          const p1 = waypoints[i];
          const p2 = waypoints[i + 1];
          const dLon = getLon(p2) - getLon(p1);
          const dLat = getLat(p2) - getLat(p1);
          totalPathLength += Math.sqrt(dLon * dLon + dLat * dLat);
        }

        const speedInDegSec = plan.speed / 216000.0;
        const timeToDestination = speedInDegSec > 0 ? totalPathLength / speedInDegSec : 0;
        const fuelLimit = plan.fuelLimit || 1000.0;
        const fuelConsumption = plan.fuelConsumption || 1.0;
        const fuelConsumptionPerSec = fuelConsumption / 60.0;
        
        if (timeMoving >= timeToDestination) {
          const fuelUsed = timeToDestination * fuelConsumptionPerSec;
          return Math.max(0, fuelLimit - fuelUsed);
        }

        const fuelUsed = timeMoving * fuelConsumptionPerSec;
        return Math.max(0, fuelLimit - fuelUsed);
      });

      return {
        label: plan.name,
        data: data,
        borderColor: color,
        backgroundColor: color + '15',
        tension: 0.15,
        fill: false
      };
    });

    this.fuelChart.data.labels = labels;
    this.fuelChart.data.datasets = fuelDatasets;
    this.fuelChart.update();

    const distanceData = this.plansList.map(plan => {
      let totalPathLength = 0;
      const waypoints = plan.waypoints || [];
      
      const getLon = (wp: Waypoint) => {
        if (wp.longitude !== undefined && wp.longitude !== null) return wp.longitude;
        return -180.0 + (wp.x / 1000) * 360.0;
      };

      const getLat = (wp: Waypoint) => {
        if (wp.latitude !== undefined && wp.latitude !== null) return wp.latitude;
        return 90.0 - (wp.y / 1000) * 180.0;
      };

      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        const dLon = getLon(p2) - getLon(p1);
        const dLat = getLat(p2) - getLat(p1);
        totalPathLength += Math.sqrt(dLon * dLon + dLat * dLat);
      }
      return Math.round(totalPathLength * 60);
    });

    const chartColors = this.plansList.map((_, idx) => this.getColors(idx) + 'aa');

    this.distanceChart.data.labels = this.plansList.map(p => p.name);
    this.distanceChart.data.datasets = [{
      label: 'Approx. Distance (NM)',
      data: distanceData,
      backgroundColor: chartColors,
      borderColor: chartColors.map(c => c.substring(0, 7)),
      borderWidth: 1.5
    }];
    this.distanceChart.update();
  }

  trackById(index: number, item: any): string {
    return item.id || index.toString();
  }

  trackByPlanId(index: number, item: any): string {
    return item.planId || index.toString();
  }
}
