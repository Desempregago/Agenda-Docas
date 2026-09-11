CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"protocol" text NOT NULL,
	"supplier_cnpj" text NOT NULL,
	"supplier_name" text DEFAULT '' NOT NULL,
	"scheduled_date" text NOT NULL,
	"time_slot" text NOT NULL,
	"dock_id" text,
	"destination_branch_id" text,
	"status" text NOT NULL,
	"total_volumes" integer DEFAULT 0 NOT NULL,
	"weight_kg" double precision DEFAULT 0 NOT NULL,
	"is_walk_in" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_configs" (
	"branch_id" text PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"cnpj" text,
	"address" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"contact_phone" text,
	"contact_email" text,
	"reception_instructions" text,
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"cnpj" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trade_name" text,
	"contact_email" text,
	"contact_phone" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"password_hash" text,
	"pin_hash" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "appointments_date_dock_idx" ON "appointments" USING btree ("scheduled_date","dock_id");--> statement-breakpoint
CREATE INDEX "appointments_date_branch_slot_idx" ON "appointments" USING btree ("scheduled_date","destination_branch_id","time_slot");--> statement-breakpoint
CREATE INDEX "appointments_supplier_cnpj_idx" ON "appointments" USING btree ("supplier_cnpj");--> statement-breakpoint
CREATE INDEX "appointments_scheduled_date_idx" ON "appointments" USING btree ("scheduled_date");--> statement-breakpoint
CREATE UNIQUE INDEX "system_users_username_idx" ON "system_users" USING btree ("username");