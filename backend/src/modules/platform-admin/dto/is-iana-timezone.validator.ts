import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { isValidIanaTimeZone } from '../../../contexts/platform/domain/services/location-timezone.policy';

export const IsIanaTimeZone = (validationOptions?: ValidationOptions): PropertyDecorator =>
  (target, propertyKey) => {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isValidIanaTimeZone(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a valid IANA time zone`,
      },
    });
  };
