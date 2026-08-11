const express = require('express');                                           
  const router = express.Router();                                              
  const bcrypt = require('bcryptjs');                                           
  const jwt = require('jsonwebtoken');    
  const { db } = require('../db/database');
  const { authenticateToken } = require('../middleware/auth');                  
  module.exports = router;
