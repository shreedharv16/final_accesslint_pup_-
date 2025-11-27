import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
export declare const databaseConfig: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    dialect: "postgres";
    dialectOptions: {
        ssl: boolean | {
            require: boolean;
            rejectUnauthorized: boolean;
        };
    };
    logging: boolean | ((msg: string) => import("winston").Logger);
    pool: {
        max: number;
        min: number;
        acquire: number;
        idle: number;
    };
    define: {
        timestamps: boolean;
        underscored: boolean;
    };
};
declare const sequelize: Sequelize;
export declare function testConnection(): Promise<boolean>;
export declare function syncDatabase(force?: boolean): Promise<void>;
export declare function closeConnection(): Promise<void>;
export default sequelize;
//# sourceMappingURL=database.d.ts.map