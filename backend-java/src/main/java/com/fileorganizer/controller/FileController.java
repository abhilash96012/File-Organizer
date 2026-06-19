package com.fileorganizer.controller;

import com.fileorganizer.model.FileRecord;
import com.fileorganizer.model.HistoryRecord;
import com.fileorganizer.repository.FileRecordRepository;
import com.fileorganizer.repository.HistoryRecordRepository;
import com.fileorganizer.service.AutoOrganizerService;
import com.fileorganizer.service.FileOrganizerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/files")
@CrossOrigin(origins = "*")
public class FileController {

    @Autowired
    private FileRecordRepository fileRecordRepository;

    @Autowired
    private HistoryRecordRepository historyRepository;

    @Autowired
    private FileOrganizerService fileOrganizerService;

    @Autowired
    private AutoOrganizerService autoOrganizerService;

    // GET /files -> get all organized files
    @GetMapping
    public ResponseEntity<List<FileRecord>> getFiles() {
        List<FileRecord> files = fileOrganizerService.getAllFilesSynced();
        return ResponseEntity.ok(files);
    }

    // GET /files/preview -> securely stream a file from local filesystem
    @GetMapping("/preview")
    public ResponseEntity<Resource> previewFile(@RequestParam String path) {
        File file = new File(path);
        if (!file.exists() || !file.isFile()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        Resource resource = new FileSystemResource(file);
        String contentType = "application/octet-stream";
        try {
            contentType = Files.probeContentType(file.toPath());
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
        } catch (IOException e) {
            // Fallback
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .body(resource);
    }

    // DELETE /files/:id -> delete file physically and from metadata database
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFile(@PathVariable String id) {
        try {
            Optional<FileRecord> opt = fileRecordRepository.findById(id);
            if (opt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "File not found"));
            }

            FileRecord fileRecord = opt.get();
            File physicalFile = new File(fileRecord.getFilePath());
            if (physicalFile.exists()) {
                if (!physicalFile.delete()) {
                    System.err.println("Could not delete physical file: " + fileRecord.getFilePath());
                }
            }

            fileRecordRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "File deleted successfully", "id", id));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error deleting file", "error", e.getMessage()));
        }
    }

    // POST /files/organize-local -> organize files in a folder path
    @PostMapping("/organize-local")
    public ResponseEntity<?> organizeLocal(@RequestBody Map<String, String> body) {
        try {
            String targetPath = body.get("targetPath");
            if (targetPath == null || targetPath.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid or missing folder path"));
            }

            List<FileRecord> organized = fileOrganizerService.organizeLocalFolder(targetPath.trim());
            return ResponseEntity.ok(Map.of("message", "Folder organized successfully", "files", organized));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error organizing folder", "error", e.getMessage()));
        }
    }

    // POST /files/unorganize-local -> restore organized folders back to root folder
    @PostMapping("/unorganize-local")
    public ResponseEntity<?> unorganizeLocal(@RequestBody Map<String, String> body) {
        try {
            String targetPath = body.get("targetPath");
            if (targetPath == null || targetPath.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid or missing folder path"));
            }

            fileOrganizerService.unorganizeLocalFolder(targetPath.trim());
            return ResponseEntity.ok(Map.of("message", "Un-organized successfully"));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error un-organizing folder", "error", e.getMessage()));
        }
    }

    // DELETE /files/category/:name -> restore entire category
    @DeleteMapping("/category/{name}")
    public ResponseEntity<?> restoreCategory(@PathVariable String name) {
        try {
            fileOrganizerService.restoreCategory(name);
            return ResponseEntity.ok(Map.of("message", "All files in " + name + " restored successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error restoring category", "error", e.getMessage()));
        }
    }

    // POST /files/bulk-rename -> bulk rename list of files
    @PostMapping("/bulk-rename")
    public ResponseEntity<?> bulkRename(@RequestBody Map<String, Object> body) {
        try {
            List<String> fileIds = (List<String>) body.get("fileIds");
            String pattern = (String) body.get("pattern");

            if (fileIds == null || fileIds.isEmpty() || pattern == null || pattern.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid data provided"));
            }

            List<FileRecord> renamed = fileOrganizerService.bulkRename(fileIds, pattern);
            return ResponseEntity.ok(Map.of("message", "Successfully renamed " + renamed.size() + " files", "files", renamed));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error bulk renaming files", "error", e.getMessage()));
        }
    }

    // POST /files/start-auto -> start monitoring folder
    @PostMapping("/start-auto")
    public ResponseEntity<?> startAuto(@RequestBody Map<String, String> body) {
        try {
            String folderPath = body.get("folderPath");
            if (folderPath == null || folderPath.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid folder path"));
            }

            folderPath = folderPath.trim();
            autoOrganizerService.startWatching(folderPath);

            // Persist status in history
            HistoryRecord history = historyRepository.findByFolderPath(folderPath)
                    .orElse(new HistoryRecord(folderPath, new Date(), true));
            history.setAutoOrganizing(true);
            historyRepository.save(history);

            return ResponseEntity.ok(Map.of("message", "Auto-organizer started", "monitoredPaths", autoOrganizerService.getMonitoredPaths()));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error starting auto-organizer", "error", e.getMessage()));
        }
    }

    // POST /files/stop-auto -> stop monitoring folder
    @PostMapping("/stop-auto")
    public ResponseEntity<?> stopAuto(@RequestBody Map<String, String> body) {
        try {
            String folderPath = body.get("folderPath");
            if (folderPath == null || folderPath.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid folder path"));
            }

            folderPath = folderPath.trim();
            autoOrganizerService.stopWatching(folderPath);

            // Persist status in history
            Optional<HistoryRecord> opt = historyRepository.findByFolderPath(folderPath);
            if (opt.isPresent()) {
                HistoryRecord history = opt.get();
                history.setAutoOrganizing(false);
                historyRepository.save(history);
            }

            return ResponseEntity.ok(Map.of("message", "Auto-organizer stopped", "monitoredPaths", autoOrganizerService.getMonitoredPaths()));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error stopping auto-organizer", "error", e.getMessage()));
        }
    }

    // GET /files/auto-status -> get list of monitored paths
    @GetMapping("/auto-status")
    public ResponseEntity<?> autoStatus() {
        return ResponseEntity.ok(Map.of("monitoredPaths", autoOrganizerService.getMonitoredPaths()));
    }
}
