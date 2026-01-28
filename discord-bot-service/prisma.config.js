"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv/config');
const { defineConfig } = require('@prisma/config');
module.exports = defineConfig({
    datasource: {
        url: process.env.DATABASE_URL,
    },
});
//# sourceMappingURL=prisma.config.js.map