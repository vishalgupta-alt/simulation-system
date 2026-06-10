import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Waypoint {
  x: number;
  y: number;
  name?: string;
}

export interface Plan {
  id?: string;
  name: string;
  speed: number;
  startTime: string;
  waypoints: Waypoint[];
  fuelLimit?: number;
  fuelConsumption?: number;
}

export interface EllipseZone {
  id?: string;
  name: string;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  controlPoints: Waypoint[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = window.location.port === '4200' ? 'http://localhost:8080/api' : '/api';

  constructor(private http: HttpClient) {}

  // Plan Endpoints
  getPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.baseUrl}/plans`);
  }

  getPlan(id: string): Observable<Plan> {
    return this.http.get<Plan>(`${this.baseUrl}/plans/${id}`);
  }

  createPlan(plan: Plan): Observable<Plan> {
    return this.http.post<Plan>(`${this.baseUrl}/plans`, plan);
  }

  updatePlan(id: string, plan: Plan): Observable<Plan> {
    return this.http.put<Plan>(`${this.baseUrl}/plans/${id}`, plan);
  }

  deletePlan(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/plans/${id}`);
  }

  // Ellipse Endpoints
  getEllipses(): Observable<EllipseZone[]> {
    return this.http.get<EllipseZone[]>(`${this.baseUrl}/ellipses`);
  }

  getEllipse(id: string): Observable<EllipseZone> {
    return this.http.get<EllipseZone>(`${this.baseUrl}/ellipses/${id}`);
  }

  createEllipse(ellipse: EllipseZone): Observable<EllipseZone> {
    return this.http.post<EllipseZone>(`${this.baseUrl}/ellipses`, ellipse);
  }

  updateEllipse(id: string, ellipse: EllipseZone): Observable<EllipseZone> {
    return this.http.put<EllipseZone>(`${this.baseUrl}/ellipses/${id}`, ellipse);
  }

  deleteEllipse(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/ellipses/${id}`);
  }
}
