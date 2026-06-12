package com.fileorganizer.service;

import com.fileorganizer.model.Category;
import com.fileorganizer.model.FileRecord;
import com.fileorganizer.model.HistoryRecord;
import com.fileorganizer.repository.CategoryRepository;
import com.fileorganizer.repository.FileRecordRepository;
import com.fileorganizer.repository.HistoryRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@Service
public class FileOrganizerService {

    @Autowired
    private FileRecordRepository fileRecordRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private HistoryRecordRepository historyRepository;

    // Generate SHA-256 file checksum
    public String getFileHash(Path filePath) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream fis = Files.newInputStream(filePath)) {
                byte[] byteArray = new byte[8192];
                int bytesCount;
                while ((bytesCount = fis.read(byteArray)) != -1) {
                    digest.update(byteArray, 0, bytesCount);
                }
            }
            byte[] bytes = digest.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not found", e);
        }
    }

    public String categorizeFile(String filename, List<Category> categories) {
        String lowercaseName = filename.toLowerCase();
        int dotIndex = lowercaseName.lastIndexOf('.');
        if (dotIndex == -1) {
            return "Others";
        }
        String ext = lowercaseName.substring(dotIndex);

        for (Category category : categories) {
            if ("Others".equalsIgnoreCase(category.getName())) {
                continue;
            }
            if (category.getExtensions() != null && category.getExtensions().contains(ext)) {
                return category.getName();
            }
        }
        return "Others";
    }

    @Transactional
    public FileRecord organizeSingleFile(String rootPath, String filename, List<Category> categories, Map<String, String> seenHashes) throws IOException {
        Path oldPath = Paths.get(rootPath, filename);
        return organizeSingleFile(rootPath, oldPath, categories, seenHashes);
    }

    @Transactional
    public FileRecord organizeSingleFile(String rootPath, Path oldPath, List<Category> categories, Map<String, String> seenHashes) throws IOException {
        if (!Files.exists(oldPath) || Files.isDirectory(oldPath)) {
            return null;
        }

        String filename = oldPath.getFileName().toString();

        // Skip hidden/system files
        if (filename.startsWith(".") || "Thumbs.db".equalsIgnoreCase(filename) || "desktop.ini".equalsIgnoreCase(filename)) {
            return null;
        }

        long size = Files.size(oldPath);
        String hash = "";
        try {
            hash = getFileHash(oldPath);
        } catch (IOException e) {
            System.err.println("Error hashing file " + filename + ": " + e.getMessage());
        }

        String category = "";
        String duplicateOf = null;

        if (!hash.isEmpty()) {
            if (seenHashes.containsKey(hash)) {
                category = "Duplicates";
                duplicateOf = seenHashes.get(hash);
            } else {
                List<FileRecord> existing = fileRecordRepository.findByHash(hash);
                if (!existing.isEmpty()) {
                    category = "Duplicates";
                    duplicateOf = existing.get(0).getFilePath();
                } else {
                    category = categorizeFile(filename, categories);
                }
            }
        } else {
            category = categorizeFile(filename, categories);
        }

        Path targetDir = Paths.get(rootPath, category);
        if (!Files.exists(targetDir)) {
            Files.createDirectories(targetDir);
        }

        Path newPath = targetDir.resolve(filename);
        String finalFilename = filename;
        Path finalPath = newPath;

        if (Files.exists(newPath)) {
            int dotIndex = filename.lastIndexOf('.');
            String base = dotIndex == -1 ? filename : filename.substring(0, dotIndex);
            String ext = dotIndex == -1 ? "" : filename.substring(dotIndex);
            finalFilename = base + "_" + System.currentTimeMillis() + ext;
            finalPath = targetDir.resolve(finalFilename);
        }

        Files.move(oldPath, finalPath, StandardCopyOption.REPLACE_EXISTING);

        if (!"Duplicates".equals(category) && !hash.isEmpty()) {
            seenHashes.put(hash, finalPath.toString());
        }

        FileRecord record = new FileRecord(
                finalFilename,
                filename,
                category,
                finalPath.toString(),
                size,
                hash,
                duplicateOf
        );

        return fileRecordRepository.save(record);
    }

    private void deleteEmptyDirectories(File directory, Path rootPath, Set<Path> categoryPaths) {
        File[] files = directory.listFiles();
        if (files == null) {
            return;
        }
        for (File file : files) {
            if (file.isDirectory()) {
                Path dirPath = file.toPath();
                // Avoid deleting target categories or the root path itself
                if (!categoryPaths.contains(dirPath) && !dirPath.equals(rootPath)) {
                    deleteEmptyDirectories(file, rootPath, categoryPaths);
                    File[] subFiles = file.listFiles();
                    if (subFiles != null && subFiles.length == 0) {
                        try {
                            Files.delete(dirPath);
                        } catch (IOException e) {
                            System.err.println("Could not delete empty folder: " + dirPath + ", error: " + e.getMessage());
                        }
                    }
                }
            }
        }
    }

    @Transactional
    public List<FileRecord> organizeLocalFolder(String targetPath) throws IOException {
        Path path = Paths.get(targetPath);
        if (!Files.exists(path) || !Files.isDirectory(path)) {
            throw new IllegalArgumentException("Invalid or missing folder path");
        }

        // Fetch categories (seed default if empty)
        List<Category> categories = categoryRepository.findAll();
        if (categories.isEmpty()) {
            seedDefaultCategories();
            categories = categoryRepository.findAll();
        }

        // Create a set of paths to skip (the target category directories)
        Set<Path> categoryPaths = new HashSet<>();
        for (Category cat : categories) {
            categoryPaths.add(path.resolve(cat.getName()));
        }
        categoryPaths.add(path.resolve("Others"));
        categoryPaths.add(path.resolve("Duplicates"));

        List<Path> allFiles = new ArrayList<>();
        try (var stream = Files.walk(path)) {
            stream.forEach(p -> {
                if (Files.isRegularFile(p)) {
                    // Check if this file is inside any of the category directories
                    boolean inCategoryDir = false;
                    for (Path catPath : categoryPaths) {
                        if (p.startsWith(catPath)) {
                            inCategoryDir = true;
                            break;
                        }
                    }
                    if (!inCategoryDir) {
                        allFiles.add(p);
                    }
                }
            });
        }

        if (allFiles.isEmpty()) {
            throw new IllegalArgumentException("Folder contains no files to organize");
        }

        // WIPE MEMORY: only track the single most recently organized folder
        fileRecordRepository.deleteAll();

        List<FileRecord> organized = new ArrayList<>();
        Map<String, String> seenHashes = new HashMap<>();

        for (Path file : allFiles) {
            try {
                FileRecord result = organizeSingleFile(targetPath, file, categories, seenHashes);
                if (result != null) {
                    organized.add(result);
                }
            } catch (Exception e) {
                System.err.println("Error organizing " + file.getFileName() + ": " + e.getMessage());
            }
        }

        // Clean up empty directories
        deleteEmptyDirectories(path.toFile(), path, categoryPaths);

        // Save in history
        HistoryRecord history = historyRepository.findByFolderPath(targetPath)
                .orElse(new HistoryRecord(targetPath, new Date(), false));
        history.setLastOrganizedAt(new Date());
        historyRepository.save(history);

        return organized;
    }

    @Transactional
    public void unorganizeLocalFolder(String targetPath) throws IOException {
        Path path = Paths.get(targetPath);
        if (!Files.exists(path) || !Files.isDirectory(path)) {
            throw new IllegalArgumentException("Invalid or missing folder path");
        }

        // Wipe metadata memory
        fileRecordRepository.deleteAll();

        // Collect names of categories to look for
        List<Category> categoriesDb = categoryRepository.findAll();
        Set<String> categoryNames = new HashSet<>();
        for (Category c : categoriesDb) {
            categoryNames.add(c.getName());
        }
        categoryNames.add("Others");
        categoryNames.add("Duplicates");

        for (String category : categoryNames) {
            Path catPath = path.resolve(category);
            if (Files.exists(catPath) && Files.isDirectory(catPath)) {
                try (DirectoryStream<Path> stream = Files.newDirectoryStream(catPath)) {
                    for (Path entry : stream) {
                        if (Files.isRegularFile(entry)) {
                            Path targetFile = path.resolve(entry.getFileName());
                            Files.move(entry, targetFile, StandardCopyOption.REPLACE_EXISTING);
                        }
                    }
                }

                // Delete directory if empty
                try {
                    Files.deleteIfExists(catPath);
                } catch (DirectoryNotEmptyException e) {
                    System.err.println("Could not delete category folder " + category + " because it is not empty.");
                }
            }
        }
    }

    @Transactional
    public void restoreCategory(String categoryName) throws IOException {
        List<FileRecord> files = fileRecordRepository.findByCategory(categoryName);
        Set<Path> parentDirs = new HashSet<>();

        for (FileRecord file : files) {
            Path currentPath = Paths.get(file.getFilePath());
            if (Files.exists(currentPath)) {
                Path currentDir = currentPath.getParent();
                Path originalDir = currentDir.getParent();
                Path restoredPath = originalDir.resolve(file.getOriginalName());

                Files.move(currentPath, restoredPath, StandardCopyOption.REPLACE_EXISTING);
                parentDirs.add(currentDir);
            }
        }

        // Try deleting empty category folders
        for (Path dir : parentDirs) {
            try {
                Files.deleteIfExists(dir);
            } catch (DirectoryNotEmptyException e) {
                System.err.println("Could not delete directory " + dir + " because it is not empty.");
            }
        }

        fileRecordRepository.deleteByCategory(categoryName);
    }

    @Transactional
    public List<FileRecord> bulkRename(List<String> fileIds, String pattern) throws IOException {
        List<FileRecord> renamed = new ArrayList<>();

        for (int i = 0; i < fileIds.size(); i++) {
            Optional<FileRecord> opt = fileRecordRepository.findById(fileIds.get(i));
            if (opt.isEmpty()) continue;

            FileRecord file = opt.get();
            Path filePath = Paths.get(file.getFilePath());
            if (!Files.exists(filePath)) continue;

            String originalName = filePath.getFileName().toString();
            int dotIndex = originalName.lastIndexOf('.');
            String ext = dotIndex == -1 ? "" : originalName.substring(dotIndex);

            String formattedIndex = String.format("%02d", i + 1);
            String newName = pattern.replace("{n}", formattedIndex) + ext;
            Path newPath = filePath.getParent().resolve(newName);

            Files.move(filePath, newPath, StandardCopyOption.REPLACE_EXISTING);

            file.setFilename(newName);
            file.setOriginalName(newName);
            file.setFilePath(newPath.toString());
            renamed.add(fileRecordRepository.save(file));
        }

        return renamed;
    }

    public void seedDefaultCategories() {
        List<Category> defaults = Arrays.asList(
                new Category("Images", Arrays.asList(".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"), true),
                new Category("Documents", Arrays.asList(".pdf", ".doc", ".docx", ".txt", ".xlsx", ".xls", ".csv", ".ppt", ".pptx"), true),
                new Category("Videos", Arrays.asList(".mp4", ".avi", ".mov", ".wmv", ".mkv"), true),
                new Category("Duplicates", new ArrayList<>(), true)
        );
        categoryRepository.saveAll(defaults);
    }
}
