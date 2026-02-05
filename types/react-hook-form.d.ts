declare module "react-hook-form" {
  // Minimal stubs to satisfy TypeScript; runtime comes from the real library.

  export function useForm<TFieldValues = any>(...args: any[]): any;
  export function useFormContext<TFieldValues = any>(): any;

  export interface FieldValues {
    [key: string]: any;
  }

  export type FieldPath<TFieldValues extends FieldValues = FieldValues> = string;

  export interface ControllerProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
  > {
    name: TName;
    control?: any;
    render: (props: any) => any;
    rules?: any;
    defaultValue?: any;
  }

  export const Controller: React.ComponentType<any>;
  export const FormProvider: React.ComponentType<any>;
}

