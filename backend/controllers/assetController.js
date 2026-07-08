const Asset = require('../models/Asset');
const AssetType = require('../models/AssetType');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

// @desc    Get all assets (paginated, sorted, filtered)
// @route   GET /api/assets
// @access  Private
const getAssets = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const { categoryId, assetTypeId, departmentId, status, search, page, limit, sort, hasTickets } = req.query;

    const filter = { tenantId, isActive: true };

    // Scope query for citizen users to assets they own or custody
    if (req.user && req.user.role === 'citizen') {
      const emailLower = req.user.email.toLowerCase();
      filter.$or = [
        { ownerUserId: req.user._id },
        { ownerEmail: emailLower },
        { custodianUserId: req.user._id },
        { custodianEmail: emailLower }
      ];
    }

    if (categoryId) filter.categoryId = categoryId;
    if (assetTypeId) filter.assetTypeId = assetTypeId;
    if (departmentId) filter.departmentId = departmentId;
    if (status) filter.status = status;

    if (hasTickets !== undefined && hasTickets !== '') {
      const tickets = await Ticket.find({ tenantId }).select('relatedAssets').lean();
      const assetIdsWithTickets = [];
      tickets.forEach(t => {
        if (t.relatedAssets) {
          t.relatedAssets.forEach(id => assetIdsWithTickets.push(id.toString()));
        }
      });
      if (hasTickets === 'true') {
        filter._id = { $in: assetIdsWithTickets };
      } else if (hasTickets === 'false') {
        filter._id = { $nin: assetIdsWithTickets };
      }
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { assetCode: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 10;
    const skip = (p - 1) * l;

    const sortField = sort ? sort.split(',').join(' ') : '-createdAt';

    const assets = await Asset.find(filter)
      .populate('categoryId', 'name')
      .populate('assetTypeId', 'name dynamicFields assetPrefix')
      .populate('departmentId', 'name')
      .populate('ownerUserId', 'name email')
      .populate('custodianUserId', 'name email')
      .sort(sortField)
      .skip(skip)
      .limit(l)
      .lean();

    const total = await Asset.countDocuments(filter);

    // Check which assets have tickets associated with them
    const assetIds = assets.map(a => a._id);
    const ticketsWithAssets = await Ticket.find({ relatedAssets: { $in: assetIds }, tenantId }).select('relatedAssets').lean();
    const assetIdsWithTickets = new Set();
    ticketsWithAssets.forEach(t => {
      if (t.relatedAssets) {
        t.relatedAssets.forEach(id => assetIdsWithTickets.add(id.toString()));
      }
    });

    const enrichedAssets = assets.map(asset => ({
      ...asset,
      hasTickets: assetIdsWithTickets.has(asset._id.toString())
    }));

    res.status(200).json({
      success: true,
      count: enrichedAssets.length,
      pagination: {
        total,
        page: p,
        pages: Math.ceil(total / l),
        limit: l
      },
      data: enrichedAssets
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single asset by ID
// @route   GET /api/assets/:id
// @access  Private
const getAssetById = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const query = { _id: req.params.id, tenantId };

    // Scope query for citizen users to assets they own or custody
    if (req.user && req.user.role === 'citizen') {
      const emailLower = req.user.email.toLowerCase();
      query.$or = [
        { ownerUserId: req.user._id },
        { ownerEmail: emailLower },
        { custodianUserId: req.user._id },
        { custodianEmail: emailLower }
      ];
    }

    const asset = await Asset.findOne(query)
      .populate('categoryId', 'name')
      .populate('assetTypeId', 'name dynamicFields assetPrefix')
      .populate('departmentId', 'name')
      .populate('ownerUserId', 'name email')
      .populate('custodianUserId', 'name email')
      .lean();

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    // Check if the asset has any ticket filed against it
    const hasTickets = !!(await Ticket.findOne({ relatedAssets: asset._id, tenantId }));

    res.status(200).json({
      success: true,
      data: {
        ...asset,
        hasTickets
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Resolve owner/custodian userId and email helper
const resolveUserAndEmail = async (userId, emailVal) => {
  let resolvedId = null;
  let resolvedEmail = '';

  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      resolvedId = user._id;
      resolvedEmail = user.email.toLowerCase();
    }
  } else if (emailVal && emailVal.trim()) {
    const emailLower = emailVal.trim().toLowerCase();
    const user = await User.findOne({ email: emailLower });
    if (user) {
      resolvedId = user._id;
      resolvedEmail = user.email.toLowerCase();
    } else {
      resolvedEmail = emailLower;
    }
  }

  return { id: resolvedId, email: resolvedEmail };
};

// @desc    Create new asset
// @route   POST /api/assets
// @access  Private (Admin only)
const createAsset = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const {
      name,
      description,
      categoryId,
      assetTypeId,
      departmentId,
      ownerUserId,
      ownerEmail,
      custodianUserId,
      custodianEmail,
      status,
      purchaseDate,
      warrantyExpiry,
      location,
      dynamicValues,
      serialNumber
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify an asset name' });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Please specify an asset category' });
    }
    if (!assetTypeId) {
      return res.status(400).json({ success: false, message: 'Please specify an asset type' });
    }

    const typeDoc = await AssetType.findById(assetTypeId);
    if (!typeDoc) {
      return res.status(400).json({ success: false, message: 'Invalid asset type' });
    }

    // Validate dynamic fields values against schema definition
    const errors = [];
    const fieldsSchema = typeDoc.dynamicFields || [];
    const values = dynamicValues || {};

    fieldsSchema.forEach(f => {
      if (f.required && (values[f.fieldKey] === undefined || values[f.fieldKey] === null || values[f.fieldKey] === '')) {
        errors.push(`Field "${f.label}" is required`);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(', ') });
    }

    const resolvedOwner = await resolveUserAndEmail(ownerUserId, ownerEmail);
    const resolvedCustodian = await resolveUserAndEmail(custodianUserId, custodianEmail);

    const asset = await Asset.create({
      tenantId,
      name: name.trim(),
      description: description ? description.trim() : '',
      categoryId,
      assetTypeId,
      departmentId: departmentId || null,
      ownerUserId: resolvedOwner.id,
      ownerEmail: resolvedOwner.email,
      custodianUserId: resolvedCustodian.id,
      custodianEmail: resolvedCustodian.email,
      status: status || 'Active',
      purchaseDate: purchaseDate || null,
      warrantyExpiry: warrantyExpiry || null,
      location: location ? location.trim() : '',
      dynamicValues: values,
      serialNumber: serialNumber ? serialNumber.trim() : ''
    });

    res.status(201).json({
      success: true,
      data: asset
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update asset
// @route   PUT /api/assets/:id
// @access  Private (Admin only)
const updateAsset = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const {
      name,
      description,
      categoryId,
      assetTypeId,
      departmentId,
      ownerUserId,
      ownerEmail,
      custodianUserId,
      custodianEmail,
      status,
      purchaseDate,
      warrantyExpiry,
      location,
      dynamicValues,
      isActive,
      serialNumber
    } = req.body;

    let asset = await Asset.findOne({ _id: req.params.id, tenantId });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    // Restrict editing: only allow if there is a ticket filed against it
    const hasTickets = await Ticket.findOne({ relatedAssets: req.params.id, tenantId });
    if (!hasTickets) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit this asset because there are no tickets filed against it.'
      });
    }

    if (name !== undefined && name.trim()) asset.name = name.trim();
    if (description !== undefined) asset.description = description ? description.trim() : '';
    if (categoryId !== undefined) asset.categoryId = categoryId;
    if (assetTypeId !== undefined) asset.assetTypeId = assetTypeId;
    if (departmentId !== undefined) asset.departmentId = departmentId || null;
    
    if (ownerUserId !== undefined || ownerEmail !== undefined) {
      const resolvedOwner = await resolveUserAndEmail(
        ownerUserId !== undefined ? ownerUserId : asset.ownerUserId,
        ownerEmail !== undefined ? ownerEmail : asset.ownerEmail
      );
      asset.ownerUserId = resolvedOwner.id;
      asset.ownerEmail = resolvedOwner.email;
    }
    
    if (custodianUserId !== undefined || custodianEmail !== undefined) {
      const resolvedCustodian = await resolveUserAndEmail(
        custodianUserId !== undefined ? custodianUserId : asset.custodianUserId,
        custodianEmail !== undefined ? custodianEmail : asset.custodianEmail
      );
      asset.custodianUserId = resolvedCustodian.id;
      asset.custodianEmail = resolvedCustodian.email;
    }
    
    if (status !== undefined) asset.status = status;
    if (purchaseDate !== undefined) asset.purchaseDate = purchaseDate || null;
    if (warrantyExpiry !== undefined) asset.warrantyExpiry = warrantyExpiry || null;
    if (location !== undefined) asset.location = location ? location.trim() : '';
    if (dynamicValues !== undefined) asset.dynamicValues = dynamicValues || {};
    if (isActive !== undefined) asset.isActive = isActive;
    if (serialNumber !== undefined) asset.serialNumber = serialNumber ? serialNumber.trim() : '';

    await asset.save();

    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete/Deactivate asset
// @route   DELETE /api/assets/:id
// @access  Private (Admin only)
const deleteAsset = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const asset = await Asset.findOne({ _id: req.params.id, tenantId });

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    asset.isActive = false;
    await asset.save();

    res.status(200).json({
      success: true,
      message: 'Asset deactivated successfully',
      data: asset
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Purchase Webhook integration: registers asset automatically from a purchase transaction
// @route   POST /api/assets/purchase
// @access  Private (Admin only)
const purchaseAsset = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const resolvedTypeName = req.params?.typeName || req.body.productCategory || req.body.productType;
    
    const {
      customerName,
      customerEmail,
      productName,
      productSku,
      serialNumber,
      warrantyMonths,
      purchaseDate,
      location
    } = req.body;

    if (!customerName || !customerEmail || !productName || !resolvedTypeName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide customerName, customerEmail, productName, and productType (either in request body or URL path)'
      });
    }

    // 1. Resolve existing user by email (do NOT auto-create user)
    const emailLower = customerEmail.trim().toLowerCase();
    const user = await User.findOne({ email: emailLower });
    
    const ownerUserId = user ? user._id : null;
    const ownerEmail = user ? user.email.toLowerCase() : emailLower;

    // 2. Resolve AssetType by name (schema template)
    const typeCleaned = resolvedTypeName.trim();
    let assetType = await AssetType.findOne({ name: { $regex: `^${typeCleaned}$`, $options: 'i' }, tenantId }).populate('categoryId');
    
    let category = null;

    if (!assetType) {
      console.log(`[Sales Webhook] Asset type "${typeCleaned}" not found. Auto-creating category & type...`);
      
      // Auto-create category matching typeName
      const AssetCategory = require('../models/AssetCategory');
      category = await AssetCategory.findOne({ name: { $regex: `^${typeCleaned}$`, $options: 'i' }, tenantId });
      if (!category) {
        category = await AssetCategory.create({
          name: typeCleaned,
          description: `Auto-created category for ${typeCleaned}`,
          tenantId
        });
      }

      // Auto-create type linked to that category
      const prefix = typeCleaned.slice(0, 3).toUpperCase();
      assetType = await AssetType.create({
        name: typeCleaned,
        assetPrefix: prefix,
        categoryId: category._id,
        tenantId
      });
    } else {
      category = assetType.categoryId;
    }

    // 3. Map e-commerce payload fields to Dynamic Fields using fieldKey & inboundMappingKey
    const dynamicValues = { ...(req.body.dynamicValues || {}) };
    if (assetType && assetType.dynamicFields) {
      assetType.dynamicFields.forEach(f => {
        // Resolve from mapping key first, then fallback to fieldKey
        let val = undefined;
        if (f.inboundMappingKey && req.body[f.inboundMappingKey] !== undefined) {
          val = req.body[f.inboundMappingKey];
        } else if (req.body[f.fieldKey] !== undefined) {
          val = req.body[f.fieldKey];
        }
        
        if (val !== undefined) {
          dynamicValues[f.fieldKey] = val;
        }
      });
    }

    // Validate required dynamic fields
    const validationErrors = [];
    const fieldsSchema = assetType.dynamicFields || [];
    fieldsSchema.forEach(f => {
      if (f.required && (dynamicValues[f.fieldKey] === undefined || dynamicValues[f.fieldKey] === null || dynamicValues[f.fieldKey] === '')) {
        validationErrors.push(`Required field "${f.label}" is missing from sales payload`);
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: validationErrors.join(', ') });
    }

    // 4. Calculate Warranty Expiry Date
    const months = Number(warrantyMonths) || 12;
    const pDate = purchaseDate ? new Date(purchaseDate) : new Date();
    const warrantyExpiry = new Date(pDate.getTime());
    warrantyExpiry.setMonth(warrantyExpiry.getMonth() + months);

    // 5. Create Asset
    const asset = await Asset.create({
      tenantId,
      name: productName.trim(),
      description: `Automatically registered from sale of SKU: ${productSku || 'N/A'}`,
      categoryId: category._id,
      assetTypeId: assetType._id,
      ownerUserId,
      ownerEmail,
      status: 'In Custody',
      purchaseDate: pDate,
      warrantyExpiry,
      location: location || 'Remote / WFH',
      serialNumber: serialNumber || '',
      dynamicValues
    });

    console.log(`[Sales Webhook] Automatically registered asset "${asset.name}" (${asset.assetCode}) for email "${ownerEmail}".`);

    res.status(201).json({
      success: true,
      message: 'Asset automatically registered and linked to customer email.',
      data: {
        assetCode: asset.assetCode,
        name: asset.name,
        owner: {
          id: ownerUserId,
          email: ownerEmail
        },
        category: category.name,
        warrantyExpiry,
        dynamicValues
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  purchaseAsset
};
