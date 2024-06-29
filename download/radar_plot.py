import random
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def color_extend(n_color):

    colors = ((246, 112, 136), (173, 156, 49), (51, 176, 122), (56, 168, 197), (204, 121, 244))
    if n_color <= len(colors):
        return np.array(colors) / 255

    batch_size = np.ceil((n_color) / 4).astype(int) + 1

    color_batch_1 = np.linspace(colors[0], colors[1], batch_size)[:-1] / 255
    color_batch_2 = np.linspace(colors[1], colors[2], batch_size)[:-1] / 255
    color_batch_3 = np.linspace(colors[2], colors[3], batch_size)[:-1] / 255
    color_batch_4 = np.linspace(colors[3], colors[4], batch_size) / 255
    colors_long = np.concatenate([color_batch_1, color_batch_2, color_batch_3, color_batch_4])
    colors_long = tuple(map(tuple, colors_long))
    return colors_long


def radar_plot(values, labels, instance_names, title='Nice title', color_map='viridis',
               fig_size=(14, 14), label_size=14, title_size=20, legend_size=14, style='seaborn',
               save_dir=None, labels_ticks=None):

    num_vars = len(labels)
    num_instance = len(values)
    
    # Handling color map selection
    if isinstance(color_map, str):
        color_map = plt.get_cmap(color_map)
    else:
        color_map = plt.cm.get_cmap(color_map)
    
    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    angles += angles[:1]

    plt.style.use(style)
    fig = plt.figure(figsize=fig_size)
    rect = [0.12, 0.12, 0.73, 0.73]

    if labels_ticks is None:
        ax = fig.add_axes(rect, projection="polar", label="axes")
        ax.set_rlabel_position(180 / num_vars)
        x = np.linspace(0, 1, 5)
        ax.set_rgrids(x, labels=x, fontsize=12, angle=180 / num_vars)
        ax.set_ylim(0, 1)
    else:
        axes = [fig.add_axes(rect, projection="polar", label="axes%d" % i)
                for i in range(num_vars)]
        ax = axes[0]
        for ax_i in axes[1:]:
            ax_i.patch.set_visible(False)
            ax_i.grid("off")
            ax_i.xaxis.set_visible(False)

        for i, (tick, ax_i, ag) in enumerate(zip(labels_ticks, axes, angles)):
            low, high = tick
            assert low < high
            x = np.linspace(0, 1, 6)
            y = np.linspace(low, high, 6)
            y = [f'{x:.1f}' for x in y]
            if low == 0:
                x = x[1:]
                y = y[1:]

            if i == 0:
                ax_i.set_rgrids(x, labels=y, fontsize=label_size, angle=0)
            else:
                ax_i.set_rgrids(x, labels=y, fontsize=label_size, angle=90 - i * 360 / num_vars)
            ax_i.spines["polar"].set_visible(False)
            ax_i.tick_params(axis='y', labelsize=label_size - 4)
            ax_i.set_ylim(0, 1)

    for i in range(num_instance):
        v = values[i]
        v += v[:1]
        ax.plot(angles, v, color=color_map(i / num_instance), linewidth=1, label=instance_names[i])
        ax.fill(angles, v, color=color_map(i / num_instance), alpha=0.25)

    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)

    ax.set_thetagrids(np.degrees(angles)[:-1], labels)

    for label, angle in zip(ax.get_xticklabels(), angles):
        if angle in (0, np.pi):
            label.set_horizontalalignment('center')
        elif 0 < angle < np.pi:
            label.set_horizontalalignment('left')
        else:
            label.set_horizontalalignment('right')

    ax.tick_params(colors='#222222')
    ax.tick_params(axis='y', labelsize=label_size-4)
    ax.tick_params(axis='x', labelsize=label_size)

    ax.set_title(title, y=1.08)
    ax.title.set_size(title_size)
    ax.legend(loc='upper right', bbox_to_anchor=(1.12, 1.2), fontsize=legend_size)

    plt.tight_layout()

    if save_dir is not None:
        plt.savefig(save_dir)
        plt.show()
    else:
        plt.show()


if __name__ == "__main__":

    all_theme = plt.style.available
    print('plot art style:', all_theme)

    num_vars = 10
    n_method = 6
    n_ticks = 5
    labels = [f'attribute_{x}' for x in range(num_vars)]
    instance_names = [f'method_{i + 1}' for i in range(n_method)]
    values = [[1 * random.random() for x in range(num_vars)] for i in range(n_method)]
    df = pd.DataFrame(columns=labels, data=values, index=instance_names)
    print('synthetic data:\n', df)

    labels_ticks = []
    for attribute in labels:
        low = random.randint(0, 3)
        high = random.randint(70, 100)
        labels_ticks.append((low, high))
        print(f'{attribute} range: (min: {low}, max: {high}):')

    radar_plot(values, labels, instance_names, title=f'This is such an amazing title', color_map='A', 
               fig_size=(12, 12), label_size=16, title_size=20, legend_size=16, style="dark_background",
               labels_ticks=labels_ticks, save_dir='dark.png')
