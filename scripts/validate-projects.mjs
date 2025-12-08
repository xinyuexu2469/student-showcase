#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(process.cwd());
const projectsDir = path.join(root, 'src', 'data', 'projects');
const publicImagesDir = path.join(root, 'public', 'images');
const schemaPath = path.join(projectsDir, 'project.schema.json');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findProjectFiles() {
  return fs
    .readdirSync(projectsDir)
    .filter((f) => f.endsWith('.json') && f !== 'project.schema.json');
}

function error(msg) {
  console.error(`\x1b[31mError:\x1b[0m ${msg}`);
}

function info(msg) {
  console.log(`\x1b[36mInfo:\x1b[0m ${msg}`);
}

async function main() {
  info(`Validating project JSON files in ${projectsDir}`);

  // Load schema
  const schema = readJSON(schemaPath);
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const files = findProjectFiles();
  if (files.length === 0) {
    error('No project JSON files found. Add files to src/data/projects/.');
    process.exit(1);
  }

  let hasErrors = false;

  for (const file of files) {
    const full = path.join(projectsDir, file);
    const data = readJSON(full);

    const valid = validate(data);
    if (!valid) {
      hasErrors = true;
      console.log(`\n\x1b[33m${file}\x1b[0m schema errors:`);
      for (const err of validate.errors) {
        console.log(` - ${err.instancePath || '(root)'} ${err.message}`);
      }
    }

    // Basic extra checks for image field (renamed to projectImage)
    if (data.imageUrl) {
      hasErrors = true;
      console.log(" - 'imageUrl' has been renamed to 'projectImage'. Please update your JSON.");
    }

    if (data.projectImage) {
      // Should be just a filename, no slashes or paths
      if (data.projectImage.includes('/') || data.projectImage.includes('\\')) {
        hasErrors = true;
        console.log(` - projectImage should be a filename only, no path (got '${data.projectImage}')`);
      } else {
        const imgPath = path.join(publicImagesDir, data.projectImage);
        if (!fs.existsSync(imgPath)) {
          hasErrors = true;
          console.log(` - image not found at public/images/${data.projectImage}`);
        } else {
          const stat = fs.statSync(imgPath);
          const maxBytes = 10 * 1024 * 1024; // 10MB
          if (stat.size > maxBytes) {
            hasErrors = true;
            console.log(` - image is large (${Math.round(stat.size/1024/1024 * 10) / 10}MB). Please keep < 10MB.`);
          }
        }
      }
    }

    if (data.studentPhoto) {
      if (data.studentPhoto.includes('/') || data.studentPhoto.includes('\\')) {
        hasErrors = true;
        console.log(` - studentPhoto should be a filename only, no path (got '${data.studentPhoto}')`);
      } else {
        const imgPath = path.join(publicImagesDir, data.studentPhoto);
        if (!fs.existsSync(imgPath)) {
          hasErrors = true;
          console.log(` - image not found at public/images/${data.studentPhoto}`);
        } else {
          const stat = fs.statSync(imgPath);
          const maxBytes = 10 * 1024 * 1024; // 10MB
          if (stat.size > maxBytes) {
            hasErrors = true;
            console.log(` - image is large (${Math.round(stat.size/1024/1024 * 10) / 10}MB). Please keep < 10MB.`);
          }
        }
      }
    }

    // Suggested field presence
    const suggested = ['projectUrl', 'githubUrl', 'tags'];
    for (const key of suggested) {
      if (!(key in data)) {
        console.log(` - suggestion: consider adding "${key}"`);
      }
    }
  }

  if (hasErrors) {
    console.log('\n\x1b[31mValidation failed. Please fix the issues above.\x1b[0m');
    process.exit(1);
  } else {
    console.log(`\n\x1b[32mAll ${files.length} project files are valid.\x1b[0m`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
