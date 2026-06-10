import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Plan } from '../../services/api.service';
import { SimulationService } from '../../services/simulation.service';
import { 
  LucideRoute, 
  LucideList, 
  LucideTrash2, 
  LucideMapPin 
} from '@lucide/angular';

@Component({
  selector: 'app-plan-panel',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    LucideRoute, 
    LucideList, 
    LucideTrash2, 
    LucideMapPin
  ],
  templateUrl: './plan-panel.component.html',
  styles: [`
    .panel-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 16px;
      overflow-y: auto;
      padding: 4px;
    }
    .plan-card {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      transition: all 0.2s;
    }
    .plan-card:hover {
      border-color: var(--color-primary);
      background: rgba(30, 41, 59, 0.6);
    }
    .active-card {
      border-color: var(--color-success) !important;
      background: rgba(16, 185, 129, 0.05);
    }
  `]
})
export class PlanPanelComponent implements OnInit {
  plans: Plan[] = [];
  
  // New Plan form fields
  newPlanName: string = '';
  newPlanSpeed: number = 10;
  newPlanStartTime: string = '2026-06-10T08:00';

  // Drawing state
  isDrawingRoute: boolean = false;
  drawnWaypoints: any[] = [];

  constructor(
    private apiService: ApiService,
    public simulationService: SimulationService
  ) {}

  ngOnInit() {
    this.loadPlans();
  }

  loadPlans() {
    this.apiService.getPlans().subscribe(plans => {
      this.plans = plans;
      this.simulationService.setPlans(plans);
    });
  }

  startDrawing() {
    if (!this.newPlanName) {
      alert('Please enter a Plan Name first.');
      return;
    }
    this.isDrawingRoute = true;
    this.drawnWaypoints = [];
    
    (window as any).isDrawingMapRoute = true;
    (window as any).tempWaypoints = [];
  }

  cancelDrawing() {
    this.isDrawingRoute = false;
    (window as any).isDrawingMapRoute = false;
    (window as any).tempWaypoints = [];
  }

  finishDrawingAndSave() {
    const waypoints = (window as any).tempWaypoints || [];
    if (waypoints.length < 2) {
      alert('Please plot at least 2 waypoints on the map.');
      return;
    }

    const plan: Plan = {
      name: this.newPlanName,
      speed: this.newPlanSpeed,
      startTime: new Date(this.newPlanStartTime).toISOString(),
      waypoints: waypoints
    };

    this.apiService.createPlan(plan).subscribe({
      next: () => {
        this.loadPlans();
        this.newPlanName = '';
        this.newPlanSpeed = 10;
        this.isDrawingRoute = false;
        (window as any).isDrawingMapRoute = false;
        (window as any).tempWaypoints = [];
      },
      error: (err) => {
        console.error('Failed to create plan', err);
        alert('Error saving plan backend server error');
      }
    });
  }

  deletePlan(id?: string) {
    if (!id) return;
    if (confirm('Are you sure you want to delete this plan?')) {
      this.apiService.deletePlan(id).subscribe(() => {
        this.loadPlans();
      });
    }
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString();
  }
}
