import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../db';
import type { Client } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { FormField } from '../ui/FormField';
import { PhoneInput } from '../ui/PhoneInput';

const schema = z.object({
  company: z.string().min(1, 'Required'),
  contactName: z.string().min(1, 'Required'),
  email: z.string().email('Must be a valid email'),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  defaultRate: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0, 'Must be 0 or more').optional(),
  ),
  status: z.enum(['lead', 'active', 'past']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ClientFormProps {
  client?: Client;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active' },
  { value: 'past', label: 'Past' },
];

export function ClientForm({ client, isOpen, onClose, onSuccess }: ClientFormProps) {
  const isEditing = !!client?.id;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      company: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      taxId: '',
      defaultRate: undefined,
      status: 'lead',
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset(
        client
          ? {
              company: client.company,
              contactName: client.contactName,
              email: client.email,
              phone: client.phone ?? '',
              address: client.address ?? '',
              taxId: client.taxId ?? '',
              defaultRate: client.defaultRate,
              status: client.status,
              notes: client.notes ?? '',
            }
          : {
              company: '',
              contactName: '',
              email: '',
              phone: '',
              address: '',
              taxId: '',
              defaultRate: undefined,
              status: 'lead',
              notes: '',
            },
      );
    }
  }, [isOpen, client, reset]);

  async function onSubmit(data: FormData) {
    const now = new Date();
    const payload = {
      company: data.company,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone || undefined,
      address: data.address || undefined,
      taxId: data.taxId || undefined,
      defaultRate: data.defaultRate,
      status: data.status,
      notes: data.notes || undefined,
      updatedAt: now,
    };

    if (isEditing && client.id) {
      await db.clients.update(client.id, payload);
      onSuccess('Client updated.');
    } else {
      await db.clients.add({ ...payload, createdAt: now });
      onSuccess('Client created.');
    }
    onClose();
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Client' : 'New Client'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Client'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Company"
              htmlFor="company"
              error={errors.company?.message}
              required
              className="col-span-2"
            >
              <Input id="company" {...register('company')} error={errors.company?.message} />
            </FormField>

            <FormField
              label="Contact Name"
              htmlFor="contactName"
              error={errors.contactName?.message}
              required
            >
              <Input id="contactName" {...register('contactName')} error={errors.contactName?.message} />
            </FormField>

            <FormField
              label="Status"
              htmlFor="status"
              error={errors.status?.message}
              required
            >
              <Select id="status" options={STATUS_OPTIONS} {...register('status')} error={errors.status?.message} />
            </FormField>

            <FormField
              label="Email"
              htmlFor="email"
              error={errors.email?.message}
              required
            >
              <Input id="email" type="email" {...register('email')} error={errors.email?.message} />
            </FormField>

            <FormField label="Phone" htmlFor="phone">
              <PhoneInput control={control} name="phone" id="phone" />
            </FormField>

            <FormField label="Default Hourly Rate" htmlFor="defaultRate" hint="Used for hourly projects without a specific rate" error={errors.defaultRate?.message}>
              <Input id="defaultRate" type="number" min={0} step={5} placeholder="0" {...register('defaultRate')} error={errors.defaultRate?.message} />
            </FormField>

            <FormField label="Tax ID / EIN" htmlFor="taxId">
              <Input id="taxId" placeholder="XX-XXXXXXX" {...register('taxId')} />
            </FormField>

            <FormField label="Address" htmlFor="address" className="col-span-2">
              <Textarea id="address" rows={2} placeholder="123 Main St&#10;City, ST 00000" {...register('address')} />
            </FormField>

            <FormField label="Notes" htmlFor="notes" className="col-span-2">
              <Textarea id="notes" rows={3} placeholder="Internal notes about this client…" {...register('notes')} />
            </FormField>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
