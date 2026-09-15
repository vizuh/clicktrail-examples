export function opportunityToConversion(opportunity = {}) {
  const won = String(opportunity.stage || opportunity.status || '').toLowerCase() === 'won';
  if (!won) return null;
  const fields = opportunity.customFields || opportunity.custom_fields || {};
  return { eventId: `twenty_${opportunity.id}_purchase`, eventName: 'Purchase', value: Number(opportunity.amount || 0), currency: String(opportunity.currency || 'USD').toUpperCase(), gclid: fields.gclid, gbraid: fields.gbraid, wbraid: fields.wbraid, customerId: opportunity.contactId || opportunity.contact_id };
}
