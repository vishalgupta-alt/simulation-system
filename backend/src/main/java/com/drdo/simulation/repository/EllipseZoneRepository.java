package com.drdo.simulation.repository;

import com.drdo.simulation.model.EllipseZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EllipseZoneRepository extends JpaRepository<EllipseZone, String> {
}
