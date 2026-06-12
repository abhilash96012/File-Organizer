package com.fileorganizer.controller;

import com.fileorganizer.model.Category;
import com.fileorganizer.repository.CategoryRepository;
import com.fileorganizer.service.FileOrganizerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/categories")
@CrossOrigin(origins = "*")
public class CategoryController {

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private FileOrganizerService fileOrganizerService;

    // GET /categories - Fetch all categories
    @GetMapping
    public ResponseEntity<List<Category>> getCategories() {
        List<Category> categories = categoryRepository.findAll();
        if (categories.isEmpty()) {
            fileOrganizerService.seedDefaultCategories();
            categories = categoryRepository.findAll();
        }
        return ResponseEntity.ok(categories);
    }

    // POST /categories - Add custom category
    @PostMapping
    public ResponseEntity<?> createCategory(@RequestBody Map<String, Object> body) {
        try {
            String name = (String) body.get("name");
            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Category name is required"));
            }

            Object extensionsObj = body.get("extensions");
            List<String> rawExtensions = new ArrayList<>();

            if (extensionsObj instanceof List) {
                for (Object ext : (List<?>) extensionsObj) {
                    rawExtensions.add(ext.toString().trim());
                }
            } else if (extensionsObj instanceof String) {
                String[] split = ((String) extensionsObj).split(",");
                for (String ext : split) {
                    rawExtensions.add(ext.trim());
                }
            }

            List<String> normalizedExtensions = new ArrayList<>();
            for (String ext : rawExtensions) {
                if (ext.isEmpty()) continue;
                String low = ext.toLowerCase();
                if (low.startsWith(".")) {
                    normalizedExtensions.add(low);
                } else {
                    normalizedExtensions.add("." + low);
                }
            }

            if (categoryRepository.findByName(name).isPresent()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Category already exists"));
            }

            Category category = new Category(name, normalizedExtensions, false);
            Category saved = categoryRepository.save(category);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error creating category", "error", e.getMessage()));
        }
    }

    // DELETE /categories/:id - Delete custom category
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteCategory(@PathVariable String id) {
        try {
            Optional<Category> opt = categoryRepository.findById(id);
            if (opt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Category not found"));
            }

            Category category = opt.get();
            if (category.isDefault()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Cannot delete default categories"));
            }

            categoryRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Category deleted"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error deleting category", "error", e.getMessage()));
        }
    }
}
