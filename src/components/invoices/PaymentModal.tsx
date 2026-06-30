import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../db';
import type { Invoice } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { FormField } from '../ui/FormField';
import { formatCurrency, toDateInputValue } from '../../utils/format';
import { parseDateInput } from '../../utils/format';

const schema = z.object({
  date: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0.01, 'Must be greater than 0'),
  method: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface PaymentModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function PaymentModal({ invoice, isOpen, onClose, onSuccess }: PaymentModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: toDateInputValue(new Date()),
      amount: invoice.balanceDue,
      method: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        date: toDateInputValue(new Date()),
        amount: invoice.balanceDue,
        method: '',
        notes: '',
      });
    }
  }, [isOpen, invoice.balanceDue, reset]);

  async function onSubmit(data: FormData) {
    if (!invoice.id) return;
    const now = new Date();
    const paymentDate = parseDateInput(data.date) ?? now;

    await db.payments.add({
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: data.amount,
      date: paymentDate,
      method: data.method || undefined,
      notes: data.notes || undefined,
      createdAt: now,
    });

    const newAmountPaid = invoice.amountPaid + data.amount;
    const newBalanceDue = Math.max(0, invoice.total - newAmountPaid);
    const newStatus = newBalanceDue <= 0 ? 'paid' : 'sent';

    await db.invoices.update(invoice.id, {
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      status: newStatus,
      updatedAt: now,
    });

    onSuccess(newStatus === 'paid' ? 'Invoice marked as paid.' : 'Payment recorded.');
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" loading={isSubmitting}>
            Record Payment
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <p className="mb-4 text-xs text-slate-400">
          Balance due: <span className="font-semibold text-slate-200">{formatCurrency(invoice.balanceDue)}</span>
        </p>
        <div className="space-y-4">
          <FormField label="Payment Date" htmlFor="pay-date" error={errors.date?.message} required>
            <Input id="pay-date" type="date" {...register('date')} error={errors.date?.message} />
          </FormField>
          <FormField label="Amount" htmlFor="pay-amount" error={errors.amount?.message} required>
            <Input
              id="pay-amount"
              type="number"
              min={0.01}
              step={0.01}
              {...register('amount')}
              error={errors.amount?.message}
            />
          </FormField>
          <FormField label="Payment Method" htmlFor="pay-method" hint="Optional">
            <Input id="pay-method" placeholder="e.g. ACH, check, wire" {...register('method')} />
          </FormField>
          <FormField label="Notes" htmlFor="pay-notes" hint="Optional">
            <Textarea id="pay-notes" rows={2} {...register('notes')} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
