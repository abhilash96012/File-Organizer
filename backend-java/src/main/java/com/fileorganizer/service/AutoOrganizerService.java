package com.fileorganizer.service;

import com.fileorganizer.model.Category;
import com.fileorganizer.repository.CategoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AutoOrganizerService {

    private final Map<String, WatcherThread> activeWatchers = new ConcurrentHashMap<>();

    @Autowired
    private FileOrganizerService fileOrganizerService;

    @Autowired
    private CategoryRepository categoryRepository;

    public synchronized void startWatching(String folderPath) {
        if (activeWatchers.containsKey(folderPath)) {
            return;
        }

        try {
            Path path = Paths.get(folderPath);
            if (!Files.exists(path) || !Files.isDirectory(path)) {
                System.err.println("Cannot watch invalid path: " + folderPath);
                return;
            }

            WatchService watchService = FileSystems.getDefault().newWatchService();
            path.register(watchService, StandardWatchEventKinds.ENTRY_CREATE);

            WatcherThread thread = new WatcherThread(folderPath, watchService, fileOrganizerService, categoryRepository);
            thread.start();
            activeWatchers.put(folderPath, thread);
            System.out.println("Starting auto-organizer for: " + folderPath);

        } catch (IOException e) {
            System.err.println("Failed to start watching path: " + folderPath + ", error: " + e.getMessage());
        }
    }

    public synchronized void stopWatching(String folderPath) {
        WatcherThread thread = activeWatchers.remove(folderPath);
        if (thread != null) {
            thread.shutdown();
            System.out.println("Stopped auto-organizer for: " + folderPath);
        }
    }

    public List<String> getMonitoredPaths() {
        return new ArrayList<>(activeWatchers.keySet());
    }

    private static class WatcherThread extends Thread {
        private final String folderPath;
        private final WatchService watchService;
        private final FileOrganizerService fileOrganizerService;
        private final CategoryRepository categoryRepository;
        private volatile boolean running = true;

        public WatcherThread(String folderPath, WatchService watchService,
                             FileOrganizerService fileOrganizerService, CategoryRepository categoryRepository) {
            this.folderPath = folderPath;
            this.watchService = watchService;
            this.fileOrganizerService = fileOrganizerService;
            this.categoryRepository = categoryRepository;
            setDaemon(true); // Don't block application exit
        }

        public void shutdown() {
            running = false;
            try {
                watchService.close();
            } catch (IOException e) {
                // Ignore close error
            }
        }

        @Override
        public void run() {
            try {
                while (running) {
                    WatchKey key = watchService.take(); // Block until events
                    for (WatchEvent<?> event : key.pollEvents()) {
                        if (!running) break;

                        WatchEvent.Kind<?> kind = event.kind();
                        if (kind == StandardWatchEventKinds.ENTRY_CREATE) {
                            Path contextPath = (Path) event.context();
                            String filename = contextPath.getFileName().toString();

                            // Skip hidden/system files
                            if (filename.startsWith(".") || "Thumbs.db".equalsIgnoreCase(filename) || "desktop.ini".equalsIgnoreCase(filename)) {
                                continue;
                            }

                            System.out.println("New file detected by watch service: " + filename);

                            // Schedule organization after 500ms to ensure writing is complete
                            new Thread(() -> {
                                try {
                                    Thread.sleep(500);
                                    List<Category> categories = categoryRepository.findAll();
                                    fileOrganizerService.organizeSingleFile(folderPath, filename, categories, new HashMap<>());
                                    System.out.println("Auto-organized file: " + filename);
                                } catch (InterruptedException e) {
                                    Thread.currentThread().interrupt();
                                } catch (Exception e) {
                                    System.err.println("Error auto-organizing file " + filename + ": " + e.getMessage());
                                }
                            }).start();
                        }
                    }

                    boolean valid = key.reset();
                    if (!valid) {
                        break;
                    }
                }
            } catch (ClosedWatchServiceException e) {
                // Watcher closed, exit normally
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                System.err.println("Exception in watcher thread for folder " + folderPath + ": " + e.getMessage());
            }
        }
    }
}
