import type { FC } from 'hono/jsx'

export const RewardInputForm: FC<{ inDrawer?: boolean }> = ({
  inDrawer = false,
}) => {
  return (
    <section class='card border border-base-300 bg-base-100 shadow-sm'>
      <div class='card-body gap-4'>
        <div class='flex items-start justify-between gap-3'>
          <div>
            <h2 class='card-title'>Add Reward</h2>
            <p class='text-sm text-base-content/70'>
              Create a reward children can buy with points.
            </p>
          </div>
          {inDrawer ? (
            <label for='task-drawer' class='btn btn-ghost btn-sm btn-circle'>
              ✕
            </label>
          ) : null}
        </div>
        <form
          hx-post='/rewards'
          hx-target='#rewards-container'
          hx-swap='innerHTML'
          hx-on--after-request='if(event.detail.successful) { this.reset(); }'
          class='grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]'
        >
          <input
            class='input input-bordered w-full'
            type='text'
            name='title'
            placeholder='Reward title'
            required
          />
          <input
            class='input input-bordered w-full'
            type='number'
            name='cost'
            placeholder='Points'
            min='1'
            required
          />
          <button class='btn btn-primary' type='submit'>
            Add Reward
          </button>
        </form>
      </div>
    </section>
  )
}
