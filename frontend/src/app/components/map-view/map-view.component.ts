import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SimulationService, SymbolState } from '../../services/simulation.service';
import { ApiService, Plan, EllipseZone, Waypoint } from '../../services/api.service';
import { Chart, registerables } from 'chart.js';
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
    .map-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.65;
      user-select: none;
      pointer-events: none;
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
export class MapViewComponent implements OnInit, OnDestroy {
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
  dragStartMouseX: number = 0;
  dragStartMouseY: number = 0;
  dragStartCenterX: number = 0;
  dragStartCenterY: number = 0;
  dragStartPoints: Waypoint[] = [];

  // Plan Form properties
  newPlanName: string = '';
  newPlanSpeed: number = 15;
  newPlanStartTime: string = '2026-06-10T08:00';
  isDrawingRoute: boolean = false;
  drawingWaypoints: Waypoint[] = [];

  // Tooltips
  hoveredSymbol: SymbolState | null = null;
  hoveredEllipse: EllipseZone | null = null;
  tooltipX: number = 0;
  tooltipY: number = 0;

  selectedPlan: Plan | null = null;
  selectedPlanWaypointsFuel: WaypointFuelDetail[] = [];
  fuelChart: Chart | null = null;
  distanceChart: Chart | null = null;
  simulationDuration: number = 24 * 3600;

  constructor(
    public simulationService: SimulationService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.simulationService.symbolStates$.subscribe(states => {
      this.symbolStates = states;
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
    });

    this.simulationService.ellipses$.subscribe(ellipses => {
      this.ellipsesList = ellipses;
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

    this.loadPlans();
    this.loadEllipses();
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
  }

  loadPlans() {
    this.apiService.getPlans().subscribe(plans => {
      this.plansList = plans;
      this.simulationService.setPlans(plans);
    });
  }

  loadEllipses() {
    this.apiService.getEllipses().subscribe(ellipses => {
      this.ellipsesList = ellipses;
      this.simulationService.setEllipses(ellipses);
    });
  }

  // --- Route Plotting & Plan Creation ---

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
      waypoints: [...this.drawingWaypoints]
    };

    this.apiService.createPlan(plan).subscribe({
      next: () => {
        this.loadPlans();
        // Reset form
        this.newPlanName = '';
        this.newPlanSpeed = 15;
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
    if (this.isDrawingRoute && (window as any).isDrawingMapRoute) {
      const rect = this.svgElement.nativeElement.getBoundingClientRect();
      const x = Math.round(event.clientX - rect.left);
      const y = Math.round(event.clientY - rect.top);
      
      const wp: Waypoint = { x, y, name: `WP ${this.drawingWaypoints.length + 1}` };
      this.drawingWaypoints.push(wp);
      
      (window as any).tempWaypoints = this.drawingWaypoints;
    }
  }

  get isDrawingActive(): boolean {
    return this.isDrawingRoute;
  }

  // --- Deploy Ellipse / Bezier Zone ---

  deployNewEllipse() {
    const rect = this.svgElement.nativeElement.getBoundingClientRect();
    const centerX = Math.round(rect.width / 2) || 400;
    const centerY = Math.round(rect.height / 2) || 250;
    const rx = 90;
    const ry = 60;
    
    const newEllipse: EllipseZone = {
      name: `Search Area ${this.ellipsesList.length + 1}`,
      centerX: centerX,
      centerY: centerY,
      radiusX: rx,
      radiusY: ry,
      rotation: 0,
      controlPoints: [
        { x: centerX + rx, y: centerY },                 // P0 (Right Anchor)
        { x: centerX + rx * 0.9, y: centerY + ry * 0.9 }, // P1 (Control Handle 1)
        { x: centerX, y: centerY + ry },                 // P2 (Bottom Anchor)
        { x: centerX - rx * 0.9, y: centerY + ry * 0.9 }, // P3 (Control Handle 2)
        { x: centerX - rx, y: centerY },                 // P4 (Left Anchor)
        { x: centerX - rx * 0.9, y: centerY - ry * 0.9 }, // P5 (Control Handle 3)
        { x: centerX, y: centerY - ry },                 // P6 (Top Anchor)
        { x: centerX + rx * 0.9, y: centerY - ry * 0.9 }  // P7 (Control Handle 4)
      ]
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

  // --- Drag and Reshape Logic ---

  startDragEllipse(ellipse: EllipseZone, handleIndex: number, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    this.draggingEllipse = ellipse;
    this.draggingHandleIndex = handleIndex;
    this.dragStartMouseX = event.clientX;
    this.dragStartMouseY = event.clientY;

    this.dragStartCenterX = ellipse.centerX;
    this.dragStartCenterY = ellipse.centerY;
    this.dragStartPoints = ellipse.controlPoints.map(p => ({ ...p }));
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.draggingEllipse) return;

    const dx = event.clientX - this.dragStartMouseX;
    const dy = event.clientY - this.dragStartMouseY;

    if (this.draggingHandleIndex === -1) {
      // Dragging entire body
      this.draggingEllipse.centerX = this.dragStartCenterX + dx;
      this.draggingEllipse.centerY = this.dragStartCenterY + dy;
      
      for (let i = 0; i < this.draggingEllipse.controlPoints.length; i++) {
        this.draggingEllipse.controlPoints[i].x = this.dragStartPoints[i].x + dx;
        this.draggingEllipse.controlPoints[i].y = this.dragStartPoints[i].y + dy;
      }
    } else {
      const idx = this.draggingHandleIndex;
      
      // Move dragged point idx by 100% of delta
      this.draggingEllipse.controlPoints[idx].x = this.dragStartPoints[idx].x + dx;
      this.draggingEllipse.controlPoints[idx].y = this.dragStartPoints[idx].y + dy;

      // Move immediate adjacent points (idx-1 and idx+1) by 50% to curve smoothly
      const prev1 = (idx - 1 + 8) % 8;
      const next1 = (idx + 1) % 8;
      this.draggingEllipse.controlPoints[prev1].x = this.dragStartPoints[prev1].x + dx * 0.5;
      this.draggingEllipse.controlPoints[prev1].y = this.dragStartPoints[prev1].y + dy * 0.5;
      this.draggingEllipse.controlPoints[next1].x = this.dragStartPoints[next1].x + dx * 0.5;
      this.draggingEllipse.controlPoints[next1].y = this.dragStartPoints[next1].y + dy * 0.5;

      // Move secondary adjacent points (idx-2 and idx+2) by 20% for natural curve falloff
      const prev2 = (idx - 2 + 8) % 8;
      const next2 = (idx + 2) % 8;
      this.draggingEllipse.controlPoints[prev2].x = this.dragStartPoints[prev2].x + dx * 0.2;
      this.draggingEllipse.controlPoints[prev2].y = this.dragStartPoints[prev2].y + dy * 0.2;
      this.draggingEllipse.controlPoints[next2].x = this.dragStartPoints[next2].x + dx * 0.2;
      this.draggingEllipse.controlPoints[next2].y = this.dragStartPoints[next2].y + dy * 0.2;

      // Recalculate center as centroid of all 8 points to keep translation logical
      const pts = this.draggingEllipse.controlPoints;
      let sumX = 0, sumY = 0;
      for (const p of pts) {
        sumX += p.x;
        sumY += p.y;
      }
      this.draggingEllipse.centerX = Math.round(sumX / 8);
      this.draggingEllipse.centerY = Math.round(sumY / 8);

      // Recalculate bounding radius approximations for tooltip
      this.draggingEllipse.radiusX = Math.round(Math.sqrt(Math.pow(pts[0].x - pts[4].x, 2) + Math.pow(pts[0].y - pts[4].y, 2)) / 2);
      this.draggingEllipse.radiusY = Math.round(Math.sqrt(Math.pow(pts[2].x - pts[6].x, 2) + Math.pow(pts[2].y - pts[6].y, 2)) / 2);
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
    const speedInPxSec = plan.speed * 10;
    const fuelConsumptionPerSec = 1.0 / 60.0;
    
    let cumulativeDist = 0;
    
    details.push({
      name: wps[0].name || 'WP 1',
      fuelRemaining: 1000.0,
      timeOffsetMinutes: 0
    });

    for (let i = 1; i < wps.length; i++) {
      const p1 = wps[i - 1];
      const p2 = wps[i];
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      cumulativeDist += dist;

      const timeToReachSeconds = speedInPxSec > 0 ? cumulativeDist / speedInPxSec : 0;
      const fuelUsed = timeToReachSeconds * fuelConsumptionPerSec;
      const fuelRemaining = Math.max(0, 1000.0 - fuelUsed);

      details.push({
        name: p2.name || `WP ${i + 1}`,
        fuelRemaining: Math.round(fuelRemaining * 10) / 10,
        timeOffsetMinutes: Math.round((timeToReachSeconds / 60) * 10) / 10
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
            min: 0,
            max: 1000
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

    // 1. Fuel Over Time Data (sample 10 intervals along the simulation duration)
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
        for (let i = 0; i < waypoints.length - 1; i++) {
          const p1 = waypoints[i];
          const p2 = waypoints[i + 1];
          totalPathLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        }

        const speedInPxSec = plan.speed * 10;
        const timeToDestination = speedInPxSec > 0 ? totalPathLength / speedInPxSec : 0;
        const fuelConsumptionPerSec = 1.0 / 60.0;
        
        if (timeMoving >= timeToDestination) {
          const fuelUsed = timeToDestination * fuelConsumptionPerSec;
          return Math.max(0, 1000.0 - fuelUsed);
        }

        const fuelUsed = timeMoving * fuelConsumptionPerSec;
        return Math.max(0, 1000.0 - fuelUsed);
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

    // 2. Distance Covered Data
    const distanceData = this.plansList.map(plan => {
      let totalPathLength = 0;
      const waypoints = plan.waypoints || [];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        totalPathLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      }
      return Math.round(totalPathLength);
    });

    const chartColors = this.plansList.map((_, idx) => this.getColors(idx) + 'aa');

    this.distanceChart.data.labels = this.plansList.map(p => p.name);
    this.distanceChart.data.datasets = [{
      label: 'Distance',
      data: distanceData,
      backgroundColor: chartColors,
      borderColor: chartColors.map(c => c.substring(0, 7)),
      borderWidth: 1.5
    }];
    this.distanceChart.update();
  }
}
