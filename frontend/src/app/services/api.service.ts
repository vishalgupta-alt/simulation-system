import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Waypoint {
  x: number;
  y: number;
  name?: string;
  latitude?: number;
  longitude?: number;
}

export interface MapMetadata {
  georeferenced: boolean;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  originalWidth: number;
  originalHeight: number;
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
  private baseUrl = window.location.port === '4200' ? 'http://localhost:8082/api' : '/api';

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

  // Map Metadata Endpoint
  getMapMetadata(): Observable<MapMetadata> {
    return this.http.get<MapMetadata>(`${this.baseUrl}/map/metadata`);
  }

  // Get Map Image URL
  getMapImageUrl(): string {
    return 'http://localhost:8080/geoserver/vishal/wms?service=WMS&version=1.1.0&request=GetMap&layers=vishal:NE2_HR_LC_SR_W_DR&bbox=-180.0,-90.0,180.0,90.0&width=2048&height=1024&srs=EPSG:4326&styles=&format=image/jpeg';
  }
}
