const mongoose = require('mongoose');
const AiSettings = require('./models/AiSettings');
const AiPrompt = require('./models/AiPrompt');
const Category = require('./models/Category');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/apexresolve');
  console.log('Connected.');

  const settings = await AiSettings.findOne({ key: 'ai_routing_config' });
  console.log('Settings:', settings);

  const activePrompt = await AiPrompt.findById(settings?.activePromptId) || await AiPrompt.findOne().sort({ version: -1 });
  console.log('Active Prompt:', activePrompt);

  const categories = await Category.find({ isActive: true });
  console.log('Categories:', categories.map(c => ({ id: c._id, name: c.name, department: c.departmentName })));

  await mongoose.disconnect();
}

check();
