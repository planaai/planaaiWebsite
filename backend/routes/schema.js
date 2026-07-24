const express = require('express');
const router = express.Router();
const { getSchemaConfig, saveSchemaConfig } = require('../config/masterDB');

router.get('/', (req, res) => res.json(getSchemaConfig()));

// Enum value CRUD
router.post('/enums/:enumKey/values', (req, res) => {
  const schemaConfig = getSchemaConfig();
  const enumDef = schemaConfig.enums[req.params.enumKey];
  if (!enumDef) return res.status(404).json({ error: 'Enum not found' });
  const { key, label } = req.body;
  if (!key || !label) return res.status(400).json({ error: 'key and label required' });
  if (enumDef.values.find(v => v.key === key)) return res.status(409).json({ error: 'Duplicate key' });
  enumDef.values.push({ key, label });
  saveSchemaConfig();
  res.json({ success: true });
});

router.delete('/enums/:enumKey/values/:valueKey', (req, res) => {
  const schemaConfig = getSchemaConfig();
  const enumDef = schemaConfig.enums[req.params.enumKey];
  if (!enumDef) return res.status(404).json({ error: 'Enum not found' });
  enumDef.values = enumDef.values.filter(v => v.key !== req.params.valueKey);
  saveSchemaConfig();
  res.json({ success: true });
});

router.post('/ooparts', (req, res) => {
  const schemaConfig = getSchemaConfig();
  schemaConfig.ooparts.push(req.body);
  saveSchemaConfig();
  res.json({ success: true });
});

router.put('/ooparts/:key', (req, res) => {
  const schemaConfig = getSchemaConfig();
  const index = schemaConfig.ooparts.findIndex(o => o.key === req.params.key);
  if (index > -1) schemaConfig.ooparts[index] = req.body;
  saveSchemaConfig();
  res.json({ success: true });
});

router.put('/resourceIcons', (req, res) => {
  const schemaConfig = getSchemaConfig();
  schemaConfig.resourceIcons = req.body;
  saveSchemaConfig();
  res.json({ success: true });
});

router.delete('/ooparts/:key', (req, res) => {
  const schemaConfig = getSchemaConfig();
  schemaConfig.ooparts = schemaConfig.ooparts.filter(o => o.key !== req.params.key);
  saveSchemaConfig();
  res.json({ success: true });
});

router.post('/equipments', (req, res) => {
  const schemaConfig = getSchemaConfig();
  schemaConfig.equipments.push(req.body);
  saveSchemaConfig();
  res.json({ success: true });
});

router.put('/equipments/:key', (req, res) => {
  const schemaConfig = getSchemaConfig();
  const index = schemaConfig.equipments.findIndex(e => e.key === req.params.key);
  if (index > -1) schemaConfig.equipments[index] = req.body;
  saveSchemaConfig();
  res.json({ success: true });
});

router.delete('/equipments/:key', (req, res) => {
  const schemaConfig = getSchemaConfig();
  schemaConfig.equipments = schemaConfig.equipments.filter(e => e.key !== req.params.key);
  saveSchemaConfig();
  res.json({ success: true });
});

router.post('/gifts', (req, res) => {
  const schemaConfig = getSchemaConfig();
  if (!schemaConfig.gifts) schemaConfig.gifts = [];
  schemaConfig.gifts.push(req.body);
  saveSchemaConfig();
  res.json({ success: true });
});

router.put('/gifts/:key', (req, res) => {
  const schemaConfig = getSchemaConfig();
  if (!schemaConfig.gifts) schemaConfig.gifts = [];
  const index = schemaConfig.gifts.findIndex(g => g.key === req.params.key);
  if (index > -1) schemaConfig.gifts[index] = req.body;
  else schemaConfig.gifts.push(req.body);
  saveSchemaConfig();
  res.json({ success: true });
});

router.delete('/gifts/:key', (req, res) => {
  const schemaConfig = getSchemaConfig();
  if (!schemaConfig.gifts) schemaConfig.gifts = [];
  schemaConfig.gifts = schemaConfig.gifts.filter(g => g.key !== req.params.key);
  saveSchemaConfig();
  res.json({ success: true });
});

module.exports = router;
