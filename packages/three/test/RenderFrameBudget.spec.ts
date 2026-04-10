import { describe, expect, it } from 'vitest';

import { RenderFrameBudget } from '../src/RenderFrameBudget';

describe('RenderFrameBudget', () => {
    it('renders the initial frame once and then idles until scheduled again', () => {
        const budget = new RenderFrameBudget();

        expect(budget.consume()).toBe(true);
        expect(budget.consume()).toBe(false);

        budget.schedule();

        expect(budget.consume()).toBe(true);
        expect(budget.consume()).toBe(false);
    });

    it('keeps the larger pending frame budget when rescheduled', () => {
        const budget = new RenderFrameBudget(0);

        budget.schedule(2);
        budget.schedule(1);

        expect(budget.consume()).toBe(true);
        expect(budget.consume()).toBe(true);
        expect(budget.consume()).toBe(false);
    });
});
