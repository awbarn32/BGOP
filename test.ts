import { CreateCustomerSchema } from './src/lib/utils/validation';

const payload = {
  full_name: 'Test Name',
  phone: null,
  line_id: null,
  email: null,
  nationality: null,
  preferred_language: 'th',
  consent_to_message: false,
  acquisition_source: null,
  notes: null,
};

const result = CreateCustomerSchema.safeParse(payload);
console.log(JSON.stringify(result, null, 2));
