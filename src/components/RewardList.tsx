import type { FC } from 'hono/jsx'
import type { RewardLike, User } from '../types'
import { RewardInputForm } from './RewardInputForm'

type RewardCard = {
  id: number
  title: string
  cost: number
}

function normalizeReward(reward: RewardLike): RewardCard {
  return {
    id: reward.id,
    title: 'title' in reward ? reward.title : reward.name,
    cost: 'cost' in reward ? reward.cost : reward.value,
  }
}

export const RewardList: FC<{
  rewards: RewardLike[]
  authUser: User
  showCreateForm?: boolean
}> = ({ rewards, authUser, showCreateForm = true }) => {
  const items = rewards.map(normalizeReward)
  const isParent = authUser.type === 'parent'

  return (
    <section class='space-y-4'>
      {isParent && showCreateForm ? <RewardInputForm /> : null}
      <section class='card border border-base-300 bg-base-100 shadow-sm'>
        <div class='card-body gap-4 p-4'>
          <div class="flex justify-between">
            <div>
              <h2 class='card-title text-base'>Rewards</h2>
              <p class='text-sm text-base-content/60'>Cash in points for family rewards.</p>
            </div>
            <label for='score-drawer' class='btn btn-ghost btn-sm btn-circle'>
              ✕
            </label>
          </div>
          <ul class='space-y-3'>
            {items.map((reward) => {
              const canAfford = authUser.points >= reward.cost
              const shortfall = reward.cost - authUser.points

              return (
                <li
                  key={reward.id}
                  class='flex items-center justify-between gap-3 p-3 rounded-box border border-base-300 '
                >
                  <div>
                    <p class='font-medium'>{reward.title}</p>
                    <p class='text-sm text-base-content/60'>{reward.cost} pts</p>
                  </div>
                  {isParent ? (
                    <span class='badge badge-outline'>{reward.cost} pts</span>
                  ) : canAfford ? (
                    <button
                      class='btn btn-primary btn-sm'
                      hx-post={`/rewards/${reward.id}/redeem`}
                      hx-target='#rewards-container'
                      hx-swap='innerHTML'
                    >
                      Redeem
                    </button>
                  ) : (
                    <div class='flex flex-col items-end gap-1'>
                      <button class='btn btn-disabled btn-sm' disabled>
                        Redeem
                      </button>
                      <span class='text-xs text-base-content/60'>
                        Need {shortfall} more pts
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
            {items.length === 0 ? (
              <li class='rounded-box border border-dashed border-base-300 px-3 py-5 text-center text-sm text-base-content/60'>
                No rewards yet
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </section>
  )
}
