-- Table: public.attendance

-- DROP TABLE IF EXISTS public.attendance;

CREATE TABLE IF NOT EXISTS public.attendance
(
    id integer NOT NULL DEFAULT nextval('attendance_id_seq'::regclass),
    employee_id integer,
    clock_in timestamp without time zone,
    clock_out timestamp without time zone,
    date date DEFAULT CURRENT_DATE,
    clockin_approved boolean DEFAULT false,
    rejected boolean DEFAULT false,
    reject_reason text COLLATE pg_catalog."default",
    CONSTRAINT attendance_pkey PRIMARY KEY (id),
    CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id)
        REFERENCES public.employees (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.attendance
    OWNER to postgres;


-- Table: public.employees

-- DROP TABLE IF EXISTS public.employees;

CREATE TABLE IF NOT EXISTS public.employees
(
    id integer NOT NULL DEFAULT nextval('employees_id_seq'::regclass),
    name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    username character varying(50) COLLATE pg_catalog."default" NOT NULL,
    email character varying(100) COLLATE pg_catalog."default" NOT NULL,
    salary numeric(10,2) NOT NULL,
    designation character varying(100) COLLATE pg_catalog."default",
    joining_date date,
    password text COLLATE pg_catalog."default",
    CONSTRAINT employees_pkey PRIMARY KEY (id),
    CONSTRAINT employees_username_key UNIQUE (username)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.employees
    OWNER to postgres;

-- Table: public.leaves

-- DROP TABLE IF EXISTS public.leaves;

CREATE TABLE IF NOT EXISTS public.leaves
(
    id integer NOT NULL DEFAULT nextval('leaves_id_seq'::regclass),
    employee_id integer,
    leave_type character varying(50) COLLATE pg_catalog."default",
    start_date date,
    end_date date,
    reason text COLLATE pg_catalog."default",
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'Pending'::character varying,
    approved boolean DEFAULT false,
    rejected boolean DEFAULT false,
    reject_reason text COLLATE pg_catalog."default",
    suggested_date date,
    CONSTRAINT leaves_pkey PRIMARY KEY (id),
    CONSTRAINT leaves_employee_id_fkey FOREIGN KEY (employee_id)
        REFERENCES public.employees (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.leaves
    OWNER to postgres;

-- Table: public.users

-- DROP TABLE IF EXISTS public.users;

CREATE TABLE IF NOT EXISTS public.users
(
    id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    username character varying(50) COLLATE pg_catalog."default" NOT NULL,
    password text COLLATE pg_catalog."default" NOT NULL,
    role character varying(10) COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_username_key UNIQUE (username),
    CONSTRAINT users_role_check CHECK (role::text = ANY (ARRAY['admin'::character varying, 'employee'::character varying]::text[]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.users
    OWNER to postgres;