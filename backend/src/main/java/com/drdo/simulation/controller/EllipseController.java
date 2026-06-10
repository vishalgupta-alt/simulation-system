package com.drdo.simulation.controller;

import com.drdo.simulation.model.EllipseZone;
import com.drdo.simulation.repository.EllipseZoneRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ellipses")
public class EllipseController {

    private final EllipseZoneRepository ellipseZoneRepository;

    @Autowired
    public EllipseController(EllipseZoneRepository ellipseZoneRepository) {
        this.ellipseZoneRepository = ellipseZoneRepository;
    }

    @GetMapping
    public List<EllipseZone> getAllEllipses() {
        return ellipseZoneRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<EllipseZone> getEllipseById(@PathVariable String id) {
        return ellipseZoneRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public EllipseZone createEllipse(@RequestBody EllipseZone ellipse) {
        if (ellipse.getId() == null || ellipse.getId().isEmpty()) {
            ellipse.setId(UUID.randomUUID().toString());
        }
        return ellipseZoneRepository.save(ellipse);
    }

    @PutMapping("/{id}")
    public ResponseEntity<EllipseZone> updateEllipse(@PathVariable String id, @RequestBody EllipseZone ellipseDetails) {
        return ellipseZoneRepository.findById(id)
                .map(existingEllipse -> {
                    ellipseDetails.setId(id);
                    EllipseZone savedEllipse = ellipseZoneRepository.save(ellipseDetails);
                    return ResponseEntity.ok(savedEllipse);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEllipse(@PathVariable String id) {
        return ellipseZoneRepository.findById(id)
                .map(ellipse -> {
                    ellipseZoneRepository.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
