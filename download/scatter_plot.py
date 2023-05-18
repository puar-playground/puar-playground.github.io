import numpy as np
import matplotlib
# matplotlib.use('TKAgg')
from matplotlib import pyplot as plt

def Cartesian_scatter(x, y, n_batch=10):

    x_out = x
    y_out = 2 * (np.random.random(x.shape[0]) - 0.5) * y

    for i in range(n_batch):
        y_temp = 2 * (np.random.random(x.shape[0]) - 0.5) * y
        x_out = np.concatenate((x_out, x), axis=0)
        y_out = np.concatenate((y_out, y_temp), axis=0)

    return x_out, y_out


def Radius_scatter(x, y, n_batch=10):

    s = np.random.random(x.shape[0])

    x_out = x * s + (np.random.random(x.shape[0])-0.5)
    y_out = y * s + 0.5 * (np.random.random(x.shape[0])-0.5)

    for i in range(n_batch):
        s = np.random.random(x.shape[0])

        x_temp = x * s + (np.random.random(x.shape[0])-0.5)
        y_temp = y * s + 0.5 * (np.random.random(x.shape[0])-0.5)

        x_out = np.concatenate((x_out, x_temp), axis=0)
        y_out = np.concatenate((y_out, y_temp), axis=0)

    return x_out, y_out


def my_plot(x, y, save_fp, scatter_c='Blues', title='My', gridsize=200, figsize=(8, 8)):
    fig, ax = plt.subplots(figsize=figsize)
    ax.tick_params(axis='both', which='major', labelsize=15)

    x_max = max(x)
    x_min = min(x)
    y_max = max(y)
    y_min = min(y)

    hb = ax.hexbin(x, y, gridsize=gridsize, bins='log', cmap=scatter_c, extent=(x_min, x_max, y_min, y_max))
    # ax.plot(np.linspace(0, x_max, 100), 0*np.linspace(0, x_max, 100), color=(0.7, 0.7, 0.7))
    ax.set_xlabel('x variable', fontsize=20)
    ax.set_ylabel('y variable', fontsize=20)
    plt.grid()
    plt.title(f'{title} scatter')

    cbar_ax = fig.add_axes([0.95, 0.1, 0.05, 0.8])
    cbar_ax.tick_params(axis='both', which='major', labelsize=15)
    cbar = fig.colorbar(hb, cax=cbar_ax)
    cbar.set_label('log10(count + 1)', fontsize=20)
    fig.savefig(save_fp, bbox_inches='tight')
    


if __name__ == "__main__":

    n_points = int(1e4)

    dimish_impulse = lambda x: np.sin(x) * np.exp(-x/10)
    x = np.linspace(0, 6*np.pi, n_points)
    magnitude = dimish_impulse(x)
    x, magnitude = Cartesian_scatter(x, magnitude)
    my_plot(x, magnitude, save_fp='./Impulse.png', title='Dimish Impulse', figsize=(10, 8))
    plt.show()
    plt.close()

    heart_x = lambda t: 16 * np.power(np.sin(t), 3)
    heart_y = lambda t: 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)

    t = np.linspace(0, 2*np.pi, n_points)
    x = heart_x(t)
    y = heart_y(t)
    x, y = Radius_scatter(x, y, n_batch=40)
    
    my_plot(x, y, save_fp='./Heart.png', scatter_c='Reds_r', gridsize=120, title='Glowing Heart')
    plt.show()

