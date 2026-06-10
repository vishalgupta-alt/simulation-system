import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewComponent } from './components/map-view/map-view.component';
import { SimulationService } from './services/simulation.service';
import { ApiService } from './services/api.service';
import { 
  LucideRoute, 
  LucideCircle, 
  LucideAreaChart,
  LucidePlay,
  LucidePause,
  LucideRotateCcw,
  LucideSkipBack,
  LucideSkipForward
} from '@lucide/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapViewComponent,
    LucideRoute,
    LucideCircle,
    LucideAreaChart,
    LucidePlay,
    LucidePause,
    LucideRotateCcw,
    LucideSkipBack,
    LucideSkipForward
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App implements OnInit {
  title = 'Tactical Simulation Command Center';
  activeTab: 'plan' | 'deploy' | 'charts' = 'deploy';

  constructor(
    public simulationService: SimulationService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.apiService.getPlans().subscribe(plans => {
      this.simulationService.setPlans(plans);
    });

    this.apiService.getEllipses().subscribe(ellipses => {
      this.simulationService.setEllipses(ellipses);
    });
  }

  switchTab(tab: 'plan' | 'deploy' | 'charts') {
    this.activeTab = tab;
  }

  onGameStartDateChange(eventVal: string) {
    if (eventVal) {
      this.simulationService.setGameStartDate(new Date(eventVal));
    }
  }

  onSliderChange(event: any) {
    const val = Number(event.target.value);
    this.simulationService.setCurrentTimeOffset(val);
  }

  getFormattedSimTime(): string {
    return this.simulationService.getCurrentTime().toLocaleTimeString();
  }

  getFormattedSimDate(): string {
    return this.simulationService.getCurrentTime().toLocaleDateString();
  }
}
