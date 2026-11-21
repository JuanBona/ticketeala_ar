// Administration module (UC-10): owns employees, areas and catalogs; other modules read them through it.
import { Module } from '@nestjs/common';
import { DestinationCatalog } from './destination-catalog.service.js';
import { DestinationsController } from './destinations.controller.js';
import { EmployeeDirectory } from './employee-directory.service.js';
import { SupplierCatalog } from './supplier-catalog.service.js';

@Module({
  controllers: [DestinationsController],
  providers: [EmployeeDirectory, DestinationCatalog, SupplierCatalog],
  exports: [EmployeeDirectory, DestinationCatalog, SupplierCatalog],
})
export class AdministrationModule {}
