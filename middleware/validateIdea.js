/**
 * validateIdea
 * ────────────
 * Express middleware — validates idea body fields
 * before they reach the controller.
 * Attach to POST and PATCH /api/ideas routes.
 */
const validateIdea = (req, res, next) => {
    const {
      title,
      shortDescription,
      detailedDescription,
      category,
      targetAudience,
      problemStatement,
      proposedSolution,
      estimatedBudget,
      imageURL,
      tags,
    } = req.body
  
    const errors = []
  
    const VALID_CATEGORIES = [
      'Tech','Health','AI','Education','Finance',
      'E-commerce','Entertainment','Social Impact','Sustainability','Other',
    ]
  
    /* ── Required fields ───────────────────────────────── */
    if (title !== undefined) {
      if (!title?.trim())                errors.push('title is required.')
      if (title?.trim().length > 120)    errors.push('title must be under 120 characters.')
    }
  
    if (shortDescription !== undefined) {
      if (!shortDescription?.trim())     errors.push('shortDescription is required.')
      if (shortDescription?.trim().length > 300) errors.push('shortDescription must be under 300 characters.')
    }
  
    if (detailedDescription !== undefined) {
      if (detailedDescription?.trim().length > 5000) errors.push('detailedDescription must be under 5000 characters.')
    }
  
    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}.`)
      }
    }
  
    if (targetAudience !== undefined) {
      if (!targetAudience?.trim())       errors.push('targetAudience is required.')
      if (targetAudience?.trim().length > 300) errors.push('targetAudience must be under 300 characters.')
    }
  
    if (problemStatement !== undefined) {
      if (!problemStatement?.trim())     errors.push('problemStatement is required.')
      if (problemStatement?.trim().length > 2000) errors.push('problemStatement must be under 2000 characters.')
    }
  
    if (proposedSolution !== undefined) {
      if (!proposedSolution?.trim())     errors.push('proposedSolution is required.')
      if (proposedSolution?.trim().length > 2000) errors.push('proposedSolution must be under 2000 characters.')
    }
  
    /* ── Optional fields ───────────────────────────────── */
    if (estimatedBudget !== undefined && estimatedBudget?.trim().length > 100) {
      errors.push('estimatedBudget must be under 100 characters.')
    }
  
    if (imageURL !== undefined && imageURL?.trim()) {
      try { new URL(imageURL.trim()) } catch {
        errors.push('imageURL must be a valid URL.')
      }
    }
  
    if (tags !== undefined) {
      const tagArray = Array.isArray(tags)
        ? tags
        : (typeof tags === 'string' ? tags.split(',') : [])
  
      if (tagArray.length > 10) {
        errors.push('Maximum 10 tags allowed.')
      }
      if (tagArray.some((t) => String(t).trim().length > 30)) {
        errors.push('Each tag must be under 30 characters.')
      }
    }
  
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],      // Return first error (simple UX)
        errors,                   // Full list for debugging
      })
    }
  
    next()
  }
  
  module.exports = validateIdea