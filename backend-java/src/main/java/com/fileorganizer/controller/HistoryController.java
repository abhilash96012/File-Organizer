package com.fileorganizer.controller;

import com.fileorganizer.model.HistoryRecord;
import com.fileorganizer.repository.HistoryRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/history")
@CrossOrigin(origins = "*")
public class HistoryController {

    @Autowired
    private HistoryRecordRepository historyRepository;

    // GET /history -> Get up to 5 most recently organized folders
    @GetMapping
    public ResponseEntity<List<HistoryRecord>> getHistory() {
        List<HistoryRecord> history = historyRepository.findTop5ByOrderByLastOrganizedAtDesc();
        return ResponseEntity.ok(history);
    }

    // DELETE /history/:id -> Delete a specific history item
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteHistory(@PathVariable String id) {
        try {
            if (!historyRepository.existsById(id)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "History item not found"));
            }
            historyRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "History item deleted"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error deleting history item", "error", e.getMessage()));
        }
    }
}
