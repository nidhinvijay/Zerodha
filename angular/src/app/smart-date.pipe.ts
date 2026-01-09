import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';

/**
 * Smart date pipe that shows:
 * - Time only (HH:mm:ss) if the date is today
 * - Date + Time (dd/MM HH:mm:ss) if the date is not today
 */
@Pipe({
    name: 'smartDate',
    standalone: true
})
export class SmartDatePipe implements PipeTransform {
    private datePipe = new DatePipe('en-US');

    transform(value: string | number | Date | null | undefined): string {
        if (!value) return '--';

        const inputDate = new Date(value);
        const today = new Date();

        // Check if same day
        const isSameDay =
            inputDate.getDate() === today.getDate() &&
            inputDate.getMonth() === today.getMonth() &&
            inputDate.getFullYear() === today.getFullYear();

        if (isSameDay) {
            // Today: show time only
            return this.datePipe.transform(value, 'HH:mm:ss') || '--';
        } else {
            // Not today: show date + time
            return this.datePipe.transform(value, 'dd/MM HH:mm:ss') || '--';
        }
    }
}
