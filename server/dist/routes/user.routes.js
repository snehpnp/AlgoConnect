"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// All user routes require authentication
router.get('/', auth_middleware_1.authenticate, user_controller_1.getUsers);
router.get('/roles', auth_middleware_1.authenticate, user_controller_1.getRoles);
// Only System Admin can manage (add/edit/delete) users and roles
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeRoles)('System Admin'), user_controller_1.createUser);
router.put('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeRoles)('System Admin'), user_controller_1.updateUser);
router.delete('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeRoles)('System Admin'), user_controller_1.deleteUser);
exports.default = router;
