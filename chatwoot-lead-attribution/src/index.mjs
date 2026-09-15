const IDS = ['gclid','gbraid','wbraid','fbclid','fbc','fbp'];
export function enrichChatwootContact(contact = {}, attribution = {}) { const customAttributes = { ...(contact.custom_attributes || {}) }; for (const key of IDS) if (attribution[key]) customAttributes[`clicktrail_${key}`] = String(attribution[key]).slice(0, 512); return { ...contact, custom_attributes: customAttributes }; }
