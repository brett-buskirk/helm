import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Input } from './Input';
import { formatPhoneNumber } from '../../utils/phone';

interface PhoneInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  id?: string;
  placeholder?: string;
}

/**
 * A phone field that applies the `(###) ###-####` mask as the user types.
 * Controlled via react-hook-form's Controller so the formatted value is what
 * gets stored.
 */
export function PhoneInput<T extends FieldValues>({ control, name, id, placeholder }: PhoneInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={placeholder ?? '(555) 123-4567'}
          name={field.name}
          ref={field.ref}
          value={(field.value as string) ?? ''}
          onBlur={field.onBlur}
          onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
        />
      )}
    />
  );
}
